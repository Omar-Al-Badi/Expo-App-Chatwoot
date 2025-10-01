{ pkgs }: {
  deps = [
    pkgs.xorg.libxshmfence
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.pango
    pkgs.nss
    pkgs.nspr
    pkgs.mesa
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.gtk3
    pkgs.glib
    pkgs.gdk-pixbuf
    pkgs.cups
    pkgs.cairo
    pkgs.atk
    pkgs.alsa-lib
    pkgs.chromium
  ];
}