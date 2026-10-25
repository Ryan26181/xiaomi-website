// Now playing, from the system media controls.
//
// Every player that shows up in the Windows media flyout (Spotify, YouTube in
// Chrome or Edge, Apple Music, Media Player, VLC…) publishes its session to
// GlobalSystemMediaTransportControlsSessionManager: track, thumbnail, status
// and timeline, with change events, and takes play/pause, skip and seek
// requests. Notchy follows whichever session Windows considers current.
// Reading it is modelled on Coucou's Spotify pill (spotify.rs, MIT).

use serde::Serialize;

pub const STATE_EVENT: &str = "media-state";
pub const ARTWORK_EVENT: &str = "media-artwork";
/// Larger thumbnails are not worth sending to the page.
const ARTWORK_LIMIT: usize = 2 * 1024 * 1024;

#[derive(Serialize, Clone, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaState {
    /// A session with a track is there.
    pub active: bool,
    /// The player, readable: "Spotify", "Chrome"…
    pub source: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// Seconds; 0 when the player does not say.
    pub duration: f64,
    /// Seconds into the track at `position_at`.
    pub position: f64,
    /// Unix ms when `position` was true; the page runs the clock on from there.
    pub position_at: f64,
    pub playing: bool,
    pub can_previous: bool,
    pub can_next: bool,
    pub can_seek: bool,
    /// Same for the same track: matches a cover to its track.
    pub art_key: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Artwork {
    pub art_key: String,
    pub data_url: String,
}

/// Windows durations and positions: 100 ns ticks → seconds.
pub fn ticks_to_secs(ticks: i64) -> f64 {
    ticks.max(0) as f64 / 10_000_000.0
}

/// A Windows DateTime (100 ns ticks since 1601) → Unix ms. Zero is "never".
pub fn windows_time_to_unix_ms(universal: i64) -> Option<f64> {
    const UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;
    (universal > UNIX_EPOCH_TICKS).then(|| (universal - UNIX_EPOCH_TICKS) as f64 / 10_000.0)
}

/// A short, stable key for a track's tags (FNV-1a).
pub fn art_key(title: &str, artist: &str, album: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in [artist, album, title].join("\u{1f}").bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    format!("{hash:016x}")
}

/// The player behind a session's app id, as people call it.
pub fn source_name(app_id: &str) -> String {
    let id = app_id.to_ascii_lowercase();
    const KNOWN: &[(&str, &str)] = &[
        ("spotify", "Spotify"),
        ("applemusic", "Apple Music"),
        ("zunemusic", "Media Player"),
        ("youtube", "YouTube Music"),
        ("msedge", "Edge"),
        ("chrome", "Chrome"),
        ("firefox", "Firefox"),
        // Firefox registers under a hash of its install path.
        ("308046b0af4a39cb", "Firefox"),
        ("brave", "Brave"),
        ("opera", "Opera"),
        ("vivaldi", "Vivaldi"),
        ("vlc", "VLC"),
        ("tidal", "TIDAL"),
        ("deezer", "Deezer"),
        ("amazonmusic", "Amazon Music"),
        ("foobar", "foobar2000"),
        ("musicbee", "MusicBee"),
        ("aimp", "AIMP"),
    ];
    if let Some((_, name)) = KNOWN.iter().find(|(key, _)| id.contains(key)) {
        return name.to_string();
    }
    // "C:\…\App.exe", "Publisher.App_hash!AppId" → "App".
    let head = app_id.split('!').next().unwrap_or(app_id);
    let tail = head.rsplit(['\\', '/']).next().unwrap_or(head);
    let tail = tail.split('_').next().unwrap_or(tail);
    let tail = tail.trim_end_matches(".exe").trim_end_matches(".EXE");
    let tail = tail.rsplit('.').next().unwrap_or(tail);
    let mut chars = tail.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => "Media".into(),
    }
}

/// The image type from its first bytes; None for anything that is not one.
pub fn sniff_image(bytes: &[u8]) -> Option<&'static str> {
    match bytes {
        [0x89, b'P', b'N', b'G', ..] => Some("image/png"),
        [0xFF, 0xD8, 0xFF, ..] => Some("image/jpeg"),
        [b'G', b'I', b'F', b'8', ..] => Some("image/gif"),
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => Some("image/webp"),
        [b'B', b'M', ..] => Some("image/bmp"),
        _ => None,
    }
}

/// Standard base64, for data URLs.
pub fn base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = match chunk.len() {
            3 => (chunk[0] as u32) << 16 | (chunk[1] as u32) << 8 | chunk[2] as u32,
            2 => (chunk[0] as u32) << 16 | (chunk[1] as u32) << 8,
            _ => (chunk[0] as u32) << 16,
        };
        out.push(TABLE[(n >> 18) as usize & 63] as char);
        out.push(TABLE[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { TABLE[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[n as usize & 63] as char } else { '=' });
    }
    out
}

pub fn data_url(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() || bytes.len() > ARTWORK_LIMIT {
        return None;
    }
    let mime = sniff_image(bytes)?;
    Some(format!("data:{mime};base64,{}", base64(bytes)))
}

pub fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[cfg(windows)]
pub use win::{control, current, start};

#[cfg(not(windows))]
mod none {
    use super::MediaState;
    use tauri::AppHandle;

    pub fn start(_app: &AppHandle) {}
    pub fn current() -> MediaState {
        MediaState::default()
    }
    pub fn control(_action: &str, _value: Option<f64>) -> bool {
        false
    }
}
#[cfg(not(windows))]
pub use none::{control, current, start};

#[cfg(windows)]
mod win {
    use super::*;
    use std::collections::VecDeque;
    use std::sync::mpsc::{self, Sender};
    use std::sync::{LazyLock, Mutex};

    use tauri::{AppHandle, Emitter};
    use windows::Foundation::TypedEventHandler;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionMediaProperties as MediaProperties,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Storage::Streams::DataReader;
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

    use crate::island::WINDOW_LABEL;

    enum Wake {
        /// The session's track, status or timeline moved.
        Changed,
        /// A player appeared, went away, or another one became current.
        Sessions,
    }

    static STATE: LazyLock<Mutex<MediaState>> = LazyLock::new(|| Mutex::new(MediaState::default()));
    /// Covers already read, by art key; the newest last.
    static ART: LazyLock<Mutex<VecDeque<(String, String)>>> = LazyLock::new(|| Mutex::new(VecDeque::new()));

    /// WinRT needs COM on the calling thread; a thread that has it keeps it.
    fn com() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
    }

    pub fn current() -> MediaState {
        STATE.lock().unwrap().clone()
    }

    pub fn start(app: &AppHandle) {
        let app = app.clone();
        let spawned = std::thread::Builder::new()
            .name("notchy-media".into())
            .spawn(move || listen(app));
        if let Err(err) = spawned {
            eprintln!("[notchy] media: no listener thread: {err}");
        }
    }

    /// Waits on the sessions' events; nothing runs between them.
    fn listen(app: AppHandle) {
        com();
        let manager = match Manager::RequestAsync().and_then(|op| op.join()) {
            Ok(m) => m,
            Err(err) => {
                eprintln!("[notchy] media: no media sessions: {err}");
                return;
            }
        };
        let (tx, rx) = mpsc::channel();
        {
            let tx = tx.clone();
            let _ = manager.SessionsChanged(&TypedEventHandler::new(move |_, _| {
                let _ = tx.send(Wake::Sessions);
                Ok(())
            }));
        }
        {
            let tx = tx.clone();
            let _ = manager.CurrentSessionChanged(&TypedEventHandler::new(move |_, _| {
                let _ = tx.send(Wake::Sessions);
                Ok(())
            }));
        }

        let mut bound: Option<Bound> = None;
        let mut rebind = true;
        loop {
            if rebind {
                if let Some(b) = bound.take() {
                    b.unbind();
                }
                bound = find_session(&manager).map(|s| Bound::bind(s, &tx));
                rebind = false;
            }
            read_and_emit(&app, bound.as_ref().map(|b| &b.session));

            // Events come in bursts (a new track moves everything): one read each.
            match rx.recv() {
                Ok(Wake::Changed) => {}
                Ok(Wake::Sessions) => rebind = true,
                Err(_) => break,
            }
            while let Ok(more) = rx.try_recv() {
                if let Wake::Sessions = more {
                    rebind = true;
                }
            }
        }
    }

    struct Bound {
        session: Session,
        tokens: [Option<i64>; 3],
    }

    impl Bound {
        fn bind(session: Session, tx: &Sender<Wake>) -> Bound {
            let tokens = [
                session.MediaPropertiesChanged(&wake_on(tx)).ok(),
                session.PlaybackInfoChanged(&wake_on(tx)).ok(),
                session.TimelinePropertiesChanged(&wake_on(tx)).ok(),
            ];
            Bound { session, tokens }
        }

        fn unbind(self) {
            let [media, playback, timeline] = self.tokens;
            if let Some(t) = media {
                let _ = self.session.RemoveMediaPropertiesChanged(t);
            }
            if let Some(t) = playback {
                let _ = self.session.RemovePlaybackInfoChanged(t);
            }
            if let Some(t) = timeline {
                let _ = self.session.RemoveTimelinePropertiesChanged(t);
            }
        }
    }

    fn wake_on<A: windows::core::RuntimeType + 'static>(tx: &Sender<Wake>) -> TypedEventHandler<Session, A> {
        let tx = tx.clone();
        TypedEventHandler::new(move |_, _| {
            let _ = tx.send(Wake::Changed);
            Ok(())
        })
    }

    /// The session Windows calls current, else one that is playing, else any.
    fn find_session(manager: &Manager) -> Option<Session> {
        if let Ok(session) = manager.GetCurrentSession() {
            return Some(session);
        }
        let sessions = manager.GetSessions().ok()?;
        let all: Vec<Session> = (0..sessions.Size().ok()?).filter_map(|i| sessions.GetAt(i).ok()).collect();
        let playing = all.iter().find(|s| {
            s.GetPlaybackInfo()
                .and_then(|i| i.PlaybackStatus())
                .is_ok_and(|st| st == Status::Playing)
        });
        playing.or(all.first()).cloned()
    }

    fn snapshot(session: &Session) -> windows::core::Result<(MediaState, MediaProperties)> {
        let props = session.TryGetMediaPropertiesAsync()?.join()?;
        let title = props.Title()?.to_string_lossy();
        let artist = props.Artist()?.to_string_lossy();
        let album = props.AlbumTitle()?.to_string_lossy();
        let timeline = session.GetTimelineProperties()?;
        let start = timeline.StartTime()?.Duration;
        let info = session.GetPlaybackInfo()?;
        let controls = info.Controls()?;
        let now = now_ms();
        let updated = windows_time_to_unix_ms(timeline.LastUpdatedTime()?.UniversalTime)
            .filter(|&t| t <= now)
            .unwrap_or(now);
        let active = !title.trim().is_empty();
        let state = MediaState {
            active,
            source: source_name(&session.SourceAppUserModelId()?.to_string_lossy()),
            art_key: art_key(&title, &artist, &album),
            title: title.trim().to_string(),
            artist: artist.trim().to_string(),
            album: album.trim().to_string(),
            duration: ticks_to_secs(timeline.EndTime()?.Duration - start),
            position: ticks_to_secs(timeline.Position()?.Duration - start),
            position_at: updated,
            playing: active && info.PlaybackStatus()? == Status::Playing,
            can_previous: controls.IsPreviousEnabled().unwrap_or(false),
            can_next: controls.IsNextEnabled().unwrap_or(false),
            can_seek: controls.IsPlaybackPositionEnabled().unwrap_or(false),
        };
        Ok((state, props))
    }

    fn read_and_emit(app: &AppHandle, session: Option<&Session>) {
        let read = session.and_then(|s| snapshot(s).ok());
        let (state, props) = match read {
            Some((state, props)) => (state, Some(props)),
            None => (MediaState::default(), None),
        };
        *STATE.lock().unwrap() = state.clone();
        let _ = app.emit_to(WINDOW_LABEL, STATE_EVENT, &state);
        if let (Some(props), true) = (props, state.active) {
            artwork(app, &state.art_key, &props);
        }
    }

    /// The track's cover as a data URL: the page loads nothing remote. A player
    /// sometimes adds the thumbnail a moment after the title; the next event
    /// brings it then.
    fn artwork(app: &AppHandle, key: &str, props: &MediaProperties) {
        let cached = ART.lock().unwrap().iter().find(|(k, _)| k == key).map(|(_, d)| d.clone());
        let data = match cached {
            Some(data) => data,
            None => {
                let Some(data) = thumbnail(props).as_deref().and_then(data_url) else { return };
                let mut art = ART.lock().unwrap();
                art.push_back((key.to_string(), data.clone()));
                while art.len() > 12 {
                    art.pop_front();
                }
                data
            }
        };
        let _ = app.emit_to(WINDOW_LABEL, ARTWORK_EVENT, Artwork { art_key: key.to_string(), data_url: data });
    }

    fn thumbnail(props: &MediaProperties) -> Option<Vec<u8>> {
        let stream = props.Thumbnail().ok()?.OpenReadAsync().ok()?.join().ok()?;
        let size = stream.Size().ok()?;
        if size == 0 || size > ARTWORK_LIMIT as u64 {
            return None;
        }
        let reader = DataReader::CreateDataReader(&stream).ok()?;
        let loaded = reader.LoadAsync(size as u32).ok()?.join().ok()?;
        let mut bytes = vec![0u8; loaded as usize];
        reader.ReadBytes(&mut bytes).ok()?;
        Some(bytes)
    }

    pub fn control(action: &str, value: Option<f64>) -> bool {
        com();
        let Some(session) = Manager::RequestAsync()
            .and_then(|op| op.join())
            .ok()
            .and_then(|m| find_session(&m))
        else {
            return false;
        };
        macro_rules! asked {
            ($op:expr) => {
                $op.and_then(|op| op.join()).unwrap_or(false)
            };
        }
        match action {
            "playPause" => asked!(session.TryTogglePlayPauseAsync()),
            "next" => asked!(session.TrySkipNextAsync()),
            "previous" => asked!(session.TrySkipPreviousAsync()),
            "seek" => {
                let Some(target) = value.filter(|v| v.is_finite() && *v >= 0.0) else { return false };
                let Ok(start) = session.GetTimelineProperties().and_then(|t| t.StartTime()) else { return false };
                let done = asked!(session.TryChangePlaybackPositionAsync(start.Duration + (target * 10_000_000.0) as i64));
                if done {
                    // Show it at once; the session's own event confirms it.
                    let mut s = STATE.lock().unwrap();
                    s.position = target;
                    s.position_at = now_ms();
                }
                done
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_times_become_seconds_and_unix_ms() {
        assert_eq!(ticks_to_secs(25_000_000), 2.5);
        assert_eq!(ticks_to_secs(-5), 0.0);
        assert_eq!(windows_time_to_unix_ms(0), None);
        assert_eq!(windows_time_to_unix_ms(116_444_736_000_000_000 + 10_000), Some(1.0));
    }

    #[test]
    fn players_get_their_usual_names() {
        assert_eq!(source_name("Spotify.exe"), "Spotify");
        assert_eq!(source_name("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"), "Spotify");
        assert_eq!(source_name("Chrome"), "Chrome");
        assert_eq!(source_name("MSEdge"), "Edge");
        assert_eq!(source_name("308046B0AF4A39CB"), "Firefox");
        assert_eq!(source_name("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"), "Apple Music");
        assert_eq!(source_name(r"C:\Program Files\Foo\foo.exe"), "Foo");
        assert_eq!(source_name("Contoso.Player_abc123!App"), "Player");
        assert_eq!(source_name(""), "Media");
    }

    #[test]
    fn the_same_tags_give_the_same_key() {
        assert_eq!(art_key("a", "b", "c"), art_key("a", "b", "c"));
        assert_ne!(art_key("a", "b", "c"), art_key("a", "b", "d"));
        assert_eq!(art_key("a", "b", "c").len(), 16);
    }

    #[test]
    fn base64_matches_the_standard() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn only_images_become_data_urls() {
        let png = [0x89, b'P', b'N', b'G', 0x0D, 0x0A];
        assert!(data_url(&png).unwrap().starts_with("data:image/png;base64,"));
        assert_eq!(data_url(b"<svg onload=alert(1)>"), None);
        assert_eq!(data_url(&[]), None);
    }
}
