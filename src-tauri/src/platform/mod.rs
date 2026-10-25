// Everything that differs between operating systems, behind one set of names.
//
// Notchy is made for Windows. The other file only keeps the app building and
// running on a Linux or macOS machine for development: no cursor poll there,
// the page follows its own mouse events instead.

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use self::windows::*;

#[cfg(not(windows))]
mod other;
#[cfg(not(windows))]
pub use self::other::*;
