// Camera setup adapted from M5Stack's CoreS3 camera example.
// https://docs.m5stack.com/en/arduino/m5cores3/camera
#include <M5Unified.h>
#include <esp_camera.h>
#include <img_converters.h>
#include <mbedtls/base64.h>

bool cameraReady = false;

void setup() {
  Serial.begin(115200);
  M5.begin(M5.config());
  M5.Display.setTextSize(2);
  M5.Display.println("USB hand detector");

  camera_config_t camera = {};
  camera.pin_pwdn = -1;
  camera.pin_reset = -1;
  camera.pin_xclk = -1;
  camera.pin_sccb_sda = 12;
  camera.pin_sccb_scl = 11;
  camera.pin_d7 = 47;
  camera.pin_d6 = 48;
  camera.pin_d5 = 16;
  camera.pin_d4 = 15;
  camera.pin_d3 = 42;
  camera.pin_d2 = 41;
  camera.pin_d1 = 40;
  camera.pin_d0 = 39;
  camera.pin_vsync = 46;
  camera.pin_href = 38;
  camera.pin_pclk = 45;
  camera.xclk_freq_hz = 20000000;
  camera.pixel_format = PIXFORMAT_RGB565;
  camera.frame_size = FRAMESIZE_QVGA;
  camera.fb_count = 2;
  camera.fb_location = CAMERA_FB_IN_PSRAM;
  camera.grab_mode = CAMERA_GRAB_LATEST;
  camera.sccb_i2c_port = -1;
  M5.In_I2C.release();
  cameraReady = esp_camera_init(&camera) == ESP_OK;
  M5.Display.println(cameraReady ? "Connect on your Mac" : "Camera init failed");
}

void loop() {
  if (Serial.read() != 'F') {
    delay(5);
    return;
  }

  camera_fb_t* frame = cameraReady ? esp_camera_fb_get() : nullptr;
  if (!frame) {
    Serial.println("ERROR Camera frame unavailable");
    return;
  }
  uint8_t* jpeg = nullptr;
  size_t jpegSize = 0;
  bool converted = frame2jpg(frame, 70, &jpeg, &jpegSize);
  esp_camera_fb_return(frame);
  if (converted) {
    size_t capacity = 4 * ((jpegSize + 2) / 3) + 1;
    auto* encoded = static_cast<unsigned char*>(malloc(capacity));
    size_t length = 0;
    if (encoded && mbedtls_base64_encode(encoded, capacity, &length, jpeg, jpegSize) == 0) {
      Serial.print("FRAME ");
      Serial.write(encoded, length);
      Serial.println();
    } else {
      Serial.println("ERROR Frame encoding failed");
    }
    free(encoded);
  } else {
    Serial.println("ERROR JPEG conversion failed");
  }
  free(jpeg);
}
