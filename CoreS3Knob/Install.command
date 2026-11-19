#!/bin/bash
set -eu
umask 077
cd -- "$(dirname -- "$0")"
tool="$HOME/Library/Arduino15/packages/esp32/tools/esptool_py/5.1.0/esptool"
[[ -x "$tool" ]] || { echo "The installed Arduino ESP32 tool could not be found."; exit 1; }
ports=(/dev/cu.usbmodem*)
if [[ ${#ports[@]} != 1 || ! -c "${ports[0]}" ]]; then
  echo "Connect just the CoreS3 over USB, then reopen this installer."
  exit 1
fi
port="${ports[0]}"
echo "Connect only the CoreS3 K128. This installer will back up its existing firmware before asking to replace it."
read -r -p "Type K128 to confirm the connected model: " model
[[ "$model" == K128 ]] || exit 1
common=(--chip esp32s3 --port "$port" --baud 460800)
identity=$("$tool" "${common[@]}" --after no-reset flash-id)
printf '%s\n' "$identity"
if [[ "$identity" != *"Detected flash size: 16MB"* ]]; then
  echo "Expected 16 MB flash. Stopping here."
  exit 1
fi
backup=$(mktemp -d "$HOME/Documents/Codex/CoreS3-backup.XXXXXXXX")
"$tool" "${common[@]}" --after no-reset read-flash 0 0x1000000 "$backup/factory.bin"
"$tool" "${common[@]}" --after no-reset read-flash 0 0x1000000 "$backup/verify.bin"
[[ $(wc -c < "$backup/factory.bin") -eq 16777216 ]]
cmp "$backup/factory.bin" "$backup/verify.bin"
rm "$backup/verify.bin"
shasum -a 256 "$backup/factory.bin" > "$backup/factory.sha256"
echo "Verified backup saved at $backup/factory.bin"
read -r -p "Type INSTALL to replace the factory demo with the detector: " answer
[[ "$answer" == INSTALL ]] || { echo "Press the CoreS3 bottom reset button once to resume the factory demo."; exit 0; }
"$tool" "${common[@]}" --after hard-reset write-flash -z \
  0x0 firmware/CoreS3Camera.ino.bootloader.bin \
  0x8000 firmware/CoreS3Camera.ino.partitions.bin \
  0xe000 firmware/boot_app0.bin \
  0x10000 firmware/CoreS3Camera.ino.bin
echo "Install verified. Look for USB hand detector on the CoreS3 screen."
echo "If the screen stays dark, press the bottom reset button once."
read -r -p "Press Return to close this window. " _
