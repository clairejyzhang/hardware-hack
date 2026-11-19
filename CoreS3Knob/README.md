# CoreS3 Knob Turns

Use the CoreS3 K128 and the same USB data cable as the camera preview test. No Gesture Unit is needed. The Mac needs Google Chrome and internet access to load the local gesture recognition model.

1. Leave the CoreS3 plugged in and close any Arduino Serial Monitor window.
2. In Finder, open Install.command. Terminal asks for K128, checks the connected chip and flash capacity, and reads the existing flash twice to verify a private backup. Keep the cable connected.
3. At the install prompt, type INSTALL to replace the factory demo with the camera streamer. Wait to see USB hand detector on the CoreS3 screen.
4. Open Open-detector.command in Finder. Leave Terminal open while the Chrome tab runs.
5. Click Connect CoreS3, select USB JTAG/serial debug unit, and click Connect.
6. Hold one hand in frame. Pinch your thumb and index finger together. Keep them touching while you turn. Turn your hand while holding the pinch. Either about 45° of wrist roll or 25° of visible tilt counts immediately. Clockwise turns add one and counterclockwise turns subtract one. Hold the turn and keep pinching to repeat every half-second. Return toward your starting angle or release to stop.

If the camera firmware is already installed, skip steps 1–3 and open the laptop launcher. Images are processed in Chrome and are not sent to the model provider.

The installer uses the Arduino ESP32 3.3.7 platform and esptool 5.1.0 already present on this Mac. The camera setup is based on [M5Stack's CoreS3 example](https://docs.m5stack.com/en/arduino/m5cores3/camera). The firmware was built with M5Unified revision 96576a14247ddc935149145aa6b51943464120f1 and M5GFX revision 28d47949bdc84f30881623476f555398e2194313. The laptop app uses [Google MediaPipe Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer?tab=Web) and MediaPipe Tasks Vision 0.10.21.

Firmware compilation and JavaScript syntax passed. The original open/closed detection worked on the physical device. The knob counter passed simulated angle tests and still needs a live gesture test.
