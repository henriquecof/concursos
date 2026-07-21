#!/usr/bin/env bash
#
# install.sh - Instala o Track Concursos como aplicativo no Linux.
#
# O que este script faz:
#   1. Cria (ou reaproveita) um ambiente virtual Python com acesso aos
#      pacotes de sistema (necessario para GTK/WebKit2).
#   2. Instala as dependencias Python (pywebview).
#   3. Cria um comando de terminal "track-concursos" em ~/.local/bin.
#   4. Instala um atalho .desktop no menu de aplicativos, com icone.
#
# Uso:
#   cd ~/GITHUB/concursos
#   ./install.sh
#
set -euo pipefail

# Descobre o diretorio real do projeto (onde este script esta), nao
# importa de onde ele seja chamado.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$REPO_DIR/venv"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons"
LOGO_SRC="$REPO_DIR/www/assets/Track Concursos logo.png"
ICON_DEST="$ICONS_DIR/track-concursos.png"

echo "==> Projeto detectado em: $REPO_DIR"

# --- 1. Dependencias de sistema -------------------------------------------
MISSING_APT_PKGS=()
python3 -c "import gi" 2>/dev/null || MISSING_APT_PKGS+=(python3-gi python3-gi-cairo gir1.2-gtk-3.0)
python3 -c "import gi; gi.require_version('WebKit2','4.1'); from gi.repository import WebKit2" 2>/dev/null \
  || python3 -c "import gi; gi.require_version('WebKit2','4.0'); from gi.repository import WebKit2" 2>/dev/null \
  || MISSING_APT_PKGS+=(gir1.2-webkit2-4.1)

if [ ${#MISSING_APT_PKGS[@]} -gt 0 ]; then
  echo "==> Instalando dependencias de sistema (pode pedir sua senha sudo)..."
  sudo apt update -qq
  if ! sudo apt install -y "${MISSING_APT_PKGS[@]}"; then
    echo "==> gir1.2-webkit2-4.1 nao encontrado, tentando gir1.2-webkit2-4.0..."
    sudo apt install -y python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.0
  fi
else
  echo "==> Dependencias de sistema (GTK/WebKit2) ja presentes."
fi

# --- 2. Ambiente virtual Python --------------------------------------------
if [ ! -d "$VENV_DIR" ]; then
  echo "==> Criando ambiente virtual em $VENV_DIR ..."
  python3 -m venv --system-site-packages "$VENV_DIR"
else
  echo "==> Ambiente virtual ja existe em $VENV_DIR"
fi

echo "==> Instalando dependencias Python (requirements.txt)..."
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install -r "$REPO_DIR/requirements.txt" --quiet

# --- 3. Comando de terminal -------------------------------------------------
mkdir -p "$BIN_DIR"
LAUNCHER="$BIN_DIR/track-concursos"
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
# Gerado automaticamente por install.sh - nao edite a mao.
exec "$VENV_DIR/bin/python" "$REPO_DIR/track_concursos_app.py" "\$@"
EOF
chmod +x "$LAUNCHER"
echo "==> Comando de terminal criado: $LAUNCHER"

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
  echo "AVISO: $BIN_DIR nao esta no seu PATH."
  echo "       Adicione esta linha ao seu ~/.bashrc (ou ~/.zshrc) e reabra o terminal:"
  echo '       export PATH="$HOME/.local/bin:$PATH"'
fi

# --- 4. Icone -----------------------------------------------------------
mkdir -p "$ICONS_DIR"
if [ -f "$LOGO_SRC" ]; then
  cp "$LOGO_SRC" "$ICON_DEST"
  ICON_LINE="$ICON_DEST"
else
  ICON_LINE="utilities-terminal"
fi

# --- 5. Atalho .desktop ---------------------------------------------------
mkdir -p "$APPS_DIR"
DESKTOP_FILE="$APPS_DIR/track-concursos.desktop"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Track Concursos
Comment=Aplicativo de gestão de estudos
Exec=$LAUNCHER
Path=$REPO_DIR
Icon=$ICON_LINE
Terminal=false
Categories=Education;Utility;
EOF
chmod +x "$DESKTOP_FILE"
echo "==> Atalho instalado: $DESKTOP_FILE"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS_DIR" 2>/dev/null || true

echo ""
echo "==> Instalação concluída!"
echo "    - Pelo terminal:   track-concursos"
echo "    - Pelo menu de apps: procure por \"Track Concursos\""