// Bluetooth devices coming and going (with their battery), and the charger.
//
// Bluetooth: a DeviceWatcher on paired Bluetooth and Bluetooth LE endpoints
// reports `System.Devices.Aep.IsConnected` as it changes. The battery is the
// `DEVPKEY_Bluetooth_Battery` property Windows sets on the device's nodes for
// headsets that report it (the same number Settings → Bluetooth shows); it is
// read once the device has settled and every couple of minutes after.
//
// Power: PowerManager raises an event when the charger is plugged in or out
// and when the percentage moves. Nothing is polled.

use serde::Serialize;

pub const BT_EVENT: &str = "bt-device";
pub const POWER_EVENT: &str = "power-state";

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BtDevice {
    pub id: String,
    pub name: String,
    pub connected: bool,
    /// "headphones", "speaker", "keyboard", "mouse", "phone", "controller" or "other".
    pub kind: &'static str,
    /// 0–100, when the device reports it.
    pub battery: Option<u8>,
    /// Already connected when Notchy started: no "connected" pop for it.
    pub initial: bool,
}

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PowerState {
    /// A laptop: there is a battery to talk about.
    pub has_battery: bool,
    /// On the charger.
    pub plugged: bool,
    /// Plugged and actually filling up (not full).
    pub charging: bool,
    pub percent: i32,
}

/// What a device is, from its Bluetooth class of device (major and minor
/// numbers, when it has one) and, for LE devices that have none, its name.
pub fn device_kind(major: Option<u32>, minor: Option<u32>, name: &str) -> &'static str {
    match (major, minor) {
        // Audio/Video: loudspeaker is minor 5; headsets, hands-free and headphones the rest.
        (Some(4), Some(5)) => return "speaker",
        (Some(4), _) => return "headphones",
        (Some(2), _) => return "phone",
        // Peripheral: bits 4–5 of the minor number say keyboard or pointer.
        (Some(5), Some(minor)) if minor & 0x30 == 0x10 => return "keyboard",
        (Some(5), Some(minor)) if minor & 0x30 == 0x20 => return "mouse",
        (Some(5), Some(minor)) if minor & 0x0f == 0x01 || minor & 0x0f == 0x02 => return "controller",
        _ => {}
    }
    let n = name.to_lowercase();
    let has = |words: &[&str]| words.iter().any(|w| n.contains(w));
    if has(&["bud", "pods", "headphone", "headset", "earphone", "wh-", "wf-", "encok", "freebuds", "airdots", "tws", "jabra", "bose qc", "beats"]) {
        "headphones"
    } else if has(&["speaker", "soundbar", "jbl flip", "jbl charge", "boom"]) {
        "speaker"
    } else if has(&["keyboard", "keys"]) {
        "keyboard"
    } else if has(&["mouse", "mx master", "trackpad"]) {
        "mouse"
    } else if has(&["controller", "gamepad", "xbox", "dualsense", "dualshock", "joy-con"]) {
        "controller"
    } else if has(&["phone", "galaxy s", "pixel", "redmi", "xiaomi", "iphone"]) {
        "phone"
    } else {
        "other"
    }
}

#[cfg(windows)]
pub use win::{bt_devices, power_state, start};

#[cfg(not(windows))]
mod none {
    use super::{BtDevice, PowerState};
    use tauri::AppHandle;

    pub fn start(_app: &AppHandle) {}
    pub fn bt_devices() -> Vec<BtDevice> {
        Vec::new()
    }
    pub fn power_state() -> PowerState {
        PowerState::default()
    }
}
#[cfg(not(windows))]
pub use none::{bt_devices, power_state, start};

#[cfg(windows)]
mod win {
    use super::*;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{mpsc, Arc, LazyLock, Mutex};
    use std::time::Duration;

    use tauri::{AppHandle, Emitter};
    use windows::core::{Interface, GUID, HSTRING, IInspectable};
    use windows::Devices::Enumeration::{
        DeviceInformation, DeviceInformationKind, DeviceInformationUpdate, DeviceWatcher,
    };
    use windows_collections::{IIterable, IMapView};
    use windows::Foundation::{EventHandler, IPropertyValue, TypedEventHandler};
    use windows::System::Power::{BatteryStatus, PowerManager, PowerSupplyStatus};
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

    use crate::island::WINDOW_LABEL;

    const CLASSIC: &str = "{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}";
    const LOW_ENERGY: &str = "{bb7bb05e-5972-42b5-94fc-76eaa7084d49}";
    const IS_CONNECTED: &str = "System.Devices.Aep.IsConnected";
    const CONTAINER: &str = "System.Devices.Aep.ContainerId";
    const COD_MAJOR: &str = "System.Devices.Aep.Bluetooth.Cod.Major";
    const COD_MINOR: &str = "System.Devices.Aep.Bluetooth.Cod.Minor";
    /// DEVPKEY_Bluetooth_Battery.
    const BATTERY: &str = "{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2";

    struct Known {
        device: BtDevice,
        container: Option<GUID>,
    }

    static DEVICES: LazyLock<Mutex<HashMap<String, Known>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

    fn com() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
    }

    pub fn start(app: &AppHandle) {
        let a = app.clone();
        let _ = std::thread::Builder::new().name("notchy-bluetooth".into()).spawn(move || {
            com();
            // One watcher per protocol: classic Bluetooth (most headsets) and LE.
            for protocol in [CLASSIC, LOW_ENERGY] {
                if let Err(err) = watch_protocol(a.clone(), protocol) {
                    eprintln!("[notchy] bluetooth {protocol}: {err}");
                }
            }
            refresh_batteries(a);
        });
        let a = app.clone();
        let _ = std::thread::Builder::new().name("notchy-power".into()).spawn(move || {
            com();
            watch_power(a);
        });
    }

    pub fn bt_devices() -> Vec<BtDevice> {
        DEVICES.lock().unwrap().values().filter(|k| k.device.connected).map(|k| k.device.clone()).collect()
    }

    // ── Bluetooth ─────────────────────────────────────────────────────────────

    fn prop<T>(props: &IMapView<HSTRING, IInspectable>, key: &str, read: impl Fn(&IPropertyValue) -> windows::core::Result<T>) -> Option<T> {
        let value = props.Lookup(&HSTRING::from(key)).ok()?;
        let value = value.cast::<IPropertyValue>().ok()?;
        read(&value).ok()
    }

    fn emit(app: &AppHandle, device: &BtDevice) {
        let _ = app.emit_to(WINDOW_LABEL, BT_EVENT, device);
    }

    /// Watches the paired devices of one protocol. Those already connected when
    /// the watcher lists them first are not announced.
    fn watch_protocol(app: AppHandle, protocol: &str) -> windows::core::Result<()> {
        let aqs = format!(
            "System.Devices.Aep.ProtocolId:=\"{protocol}\" AND System.Devices.Aep.IsPaired:=System.StructuredQueryType.Boolean#True"
        );
        let enumerated = Arc::new(AtomicBool::new(false));
        let wanted: IIterable<HSTRING> =
            vec![HSTRING::from(IS_CONNECTED), HSTRING::from(CONTAINER), HSTRING::from(COD_MAJOR), HSTRING::from(COD_MINOR)].into();
        let watcher = DeviceInformation::CreateWatcherWithKindAqsFilterAndAdditionalProperties(
            &HSTRING::from(aqs),
            &wanted,
            DeviceInformationKind::AssociationEndpoint,
        )?;

        let a = app.clone();
        let listed = enumerated.clone();
        watcher.Added(&TypedEventHandler::<DeviceWatcher, DeviceInformation>::new(move |_, info| {
            let Some(info) = info.as_ref() else { return Ok(()) };
            let props = info.Properties()?;
            let name = info.Name()?.to_string_lossy();
            let connected = prop(&props, IS_CONNECTED, |v| v.GetBoolean()).unwrap_or(false);
            let initial = !listed.load(Ordering::Relaxed);
            let device = BtDevice {
                id: info.Id()?.to_string_lossy(),
                kind: device_kind(prop(&props, COD_MAJOR, |v| v.GetUInt32()), prop(&props, COD_MINOR, |v| v.GetUInt32()), &name),
                name,
                connected,
                battery: None,
                initial,
            };
            let container = prop(&props, CONTAINER, |v| v.GetGuid());
            DEVICES.lock().unwrap().insert(device.id.clone(), Known { device: device.clone(), container });
            if connected {
                if !initial {
                    emit(&a, &device);
                }
                read_battery_soon(a.clone(), device.id.clone());
            }
            Ok(())
        }))?;

        let a = app.clone();
        watcher.Updated(&TypedEventHandler::<DeviceWatcher, DeviceInformationUpdate>::new(move |_, update| {
            let Some(update) = update.as_ref() else { return Ok(()) };
            let id = update.Id()?.to_string_lossy();
            let props = update.Properties()?;
            let Some(connected) = prop(&props, IS_CONNECTED, |v| v.GetBoolean()) else { return Ok(()) };
            let changed = {
                let mut devices = DEVICES.lock().unwrap();
                let Some(known) = devices.get_mut(&id) else { return Ok(()) };
                if known.device.connected == connected {
                    None
                } else {
                    known.device.connected = connected;
                    known.device.initial = false;
                    if !connected {
                        known.device.battery = None;
                    }
                    Some(known.device.clone())
                }
            };
            if let Some(device) = changed {
                emit(&a, &device);
                if connected {
                    read_battery_soon(a.clone(), id);
                }
            }
            Ok(())
        }))?;

        watcher.Removed(&TypedEventHandler::<DeviceWatcher, DeviceInformationUpdate>::new(move |_, update| {
            if let Some(update) = update.as_ref() {
                DEVICES.lock().unwrap().remove(&update.Id()?.to_string_lossy());
            }
            Ok(())
        }))?;

        watcher.EnumerationCompleted(&TypedEventHandler::<DeviceWatcher, IInspectable>::new(move |_, _| {
            enumerated.store(true, Ordering::Relaxed);
            Ok(())
        }))?;

        watcher.Start()?;
        // The watcher lives as long as the app; its handlers hold what they need.
        std::mem::forget(watcher);
        Ok(())
    }

    fn guid_text(g: &GUID) -> String {
        format!(
            "{:08X}-{:04X}-{:04X}-{:02X}{:02X}-{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}",
            g.data1, g.data2, g.data3, g.data4[0], g.data4[1], g.data4[2], g.data4[3], g.data4[4], g.data4[5], g.data4[6], g.data4[7]
        )
    }

    /// The battery a device's nodes report, if any of them does.
    fn battery_of(container: &GUID) -> Option<u8> {
        let aqs = HSTRING::from(format!("System.Devices.ContainerId:=\"{{{}}}\"", guid_text(container)));
        let wanted: IIterable<HSTRING> = vec![HSTRING::from(BATTERY)].into();
        let nodes = DeviceInformation::FindAllAsyncWithKindAqsFilterAndAdditionalProperties(&aqs, &wanted, DeviceInformationKind::Device)
            .ok()?
            .join()
            .ok()?;
        (0..nodes.Size().ok()?)
            .filter_map(|i| nodes.GetAt(i).ok())
            .filter_map(|node| prop(&node.Properties().ok()?, BATTERY, |v| v.GetUInt8()))
            .find(|level| *level <= 100)
    }

    fn update_battery(app: &AppHandle, id: &str) {
        let container = {
            let devices = DEVICES.lock().unwrap();
            match devices.get(id) {
                Some(k) if k.device.connected => k.container,
                _ => return,
            }
        };
        let Some(level) = container.as_ref().and_then(battery_of) else { return };
        let changed = {
            let mut devices = DEVICES.lock().unwrap();
            let Some(known) = devices.get_mut(id) else { return };
            if known.device.battery == Some(level) {
                None
            } else {
                known.device.battery = Some(level);
                Some(known.device.clone())
            }
        };
        if let Some(device) = changed {
            emit(app, &device);
        }
    }

    /// A headset tells Windows its battery a moment after it connects.
    fn read_battery_soon(app: AppHandle, id: String) {
        std::thread::spawn(move || {
            com();
            for wait in [1500, 4000] {
                std::thread::sleep(Duration::from_millis(wait));
                update_battery(&app, &id);
            }
        });
    }

    /// Every two minutes, the battery of what is connected.
    fn refresh_batteries(app: AppHandle) {
        loop {
            std::thread::sleep(Duration::from_secs(120));
            let ids: Vec<String> = DEVICES
                .lock()
                .unwrap()
                .values()
                .filter(|k| k.device.connected)
                .map(|k| k.device.id.clone())
                .collect();
            for id in ids {
                update_battery(&app, &id);
            }
        }
    }

    // ── Power ─────────────────────────────────────────────────────────────────

    pub fn power_state() -> PowerState {
        com();
        let battery = PowerManager::BatteryStatus().unwrap_or(BatteryStatus::NotPresent);
        let supply = PowerManager::PowerSupplyStatus().unwrap_or(PowerSupplyStatus::NotPresent);
        PowerState {
            has_battery: battery != BatteryStatus::NotPresent,
            plugged: supply != PowerSupplyStatus::NotPresent,
            charging: battery == BatteryStatus::Charging,
            percent: PowerManager::RemainingChargePercent().unwrap_or(0).clamp(0, 100),
        }
    }

    fn watch_power(app: AppHandle) {
        let (tx, rx) = mpsc::channel::<()>();
        let handler = |tx: mpsc::Sender<()>| {
            EventHandler::<IInspectable>::new(move |_, _| {
                let _ = tx.send(());
                Ok(())
            })
        };
        let _ = PowerManager::BatteryStatusChanged(&handler(tx.clone()));
        let _ = PowerManager::PowerSupplyStatusChanged(&handler(tx.clone()));
        let _ = PowerManager::RemainingChargePercentChanged(&handler(tx));

        let mut last = power_state();
        let _ = app.emit_to(WINDOW_LABEL, POWER_EVENT, &last);
        while rx.recv().is_ok() {
            // The three events often fire together.
            std::thread::sleep(Duration::from_millis(150));
            while rx.try_recv().is_ok() {}
            let now = power_state();
            if now != last {
                last = now.clone();
                let _ = app.emit_to(WINDOW_LABEL, POWER_EVENT, &now);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn class_of_device_says_what_it_is() {
        assert_eq!(device_kind(Some(4), Some(6), "WH-1000XM5"), "headphones");
        assert_eq!(device_kind(Some(4), Some(5), "Living room"), "speaker");
        assert_eq!(device_kind(Some(5), Some(0x10), "K380"), "keyboard");
        assert_eq!(device_kind(Some(5), Some(0x20), "M720"), "mouse");
        assert_eq!(device_kind(Some(5), Some(0x02), "Pad"), "controller");
        assert_eq!(device_kind(Some(2), None, "Phone"), "phone");
    }

    #[test]
    fn low_energy_devices_are_told_by_their_name() {
        assert_eq!(device_kind(None, None, "Baseus Encok WM01"), "headphones");
        assert_eq!(device_kind(None, None, "Galaxy Buds2 Pro"), "headphones");
        assert_eq!(device_kind(None, None, "MX Master 3S"), "mouse");
        assert_eq!(device_kind(None, None, "Xbox Wireless Controller"), "controller");
        assert_eq!(device_kind(None, None, "Something"), "other");
    }
}
