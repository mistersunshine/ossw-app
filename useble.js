/* eslint-disable no-bitwise */
import { useMemo, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

import * as ExpoDevice from "expo-device";

import base64 from "react-native-base64";
import { BleManager } from "react-native-ble-plx";
import { Buffer } from "buffer";

const bleManager = new BleManager();

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const deviceIsAllowed = (device) => {
  const DEVICE_NAME_WHITELIST = ["Arduino", "Feather", "ESP32"];
  let matchFound = false;
  let index = 0;
  do {
    matchFound =
      (device.localName &&
        device.localName.indexOf(DEVICE_NAME_WHITELIST[index]) > -1) ||
      (device.name && device.name.indexOf(DEVICE_NAME_WHITELIST[index]) > -1);
    index++;
  } while (!matchFound && index < DEVICE_NAME_WHITELIST.length);

  return matchFound;
};

function useBLE() {
  const [allDevices, setAllDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);

  const requestAndroid31Permissions = async () => {
    const bluetoothScanPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      },
    );
    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      },
    );
    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      },
    );

    return (
      bluetoothScanPermission === "granted" &&
      bluetoothConnectPermission === "granted" &&
      fineLocationPermission === "granted"
    );
  };

  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth Low Energy requires Location",
            buttonPositive: "OK",
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const isAndroid31PermissionsGranted =
          await requestAndroid31Permissions();

        return isAndroid31PermissionsGranted;
      }
    } else {
      return true;
    }
  };

  const isDuplicateDevice = (devices, nextDevice) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const populateDevices = () =>
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
      }

      if (
        device &&
        (device.localName || device.name) &&
        deviceIsAllowed(device)
      ) {
        setAllDevices((prevState) => {
          if (!isDuplicateDevice(prevState, device)) {
            return [...prevState, device];
          }
          return prevState;
        });
      }
    });

  const connectToDevice = async (device) => {
    try {
      const deviceConnection = await bleManager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();
      // startStreamingData(deviceConnection);
    } catch (e) {
      console.log("Failed to connectToDevice", e);
    }
  };

  const disconnectCurrentDevice = async () => {
    if (connectedDevice) {
      try {
        // stopStreamingData(connectedDevice);
        await connectedDevice.cancelConnection();
        setConnectedDevice(null);
      } catch (e) {
        console.log("Failed to disconnectCurrentDevice", e);
      }
    }
  };

  const sendData = (str) => {
    // THIS IS THE MAGIC SAUCE THAT ENABLES A STRING TO BE SENT TO ARDUINO ESP32 WITH BLE USING BLEDEVICE LIBRARY
    const myBuffer = Buffer.from(str).toString("base64");

    connectedDevice
      .writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        myBuffer,
      )
      .catch((e) => {
        console.log("Failed to sendData", JSON.stringify(e));
      });
  };

  return {
    connectToDevice,
    allDevices,
    connectedDevice,
    requestPermissions,
    populateDevices,
    disconnectCurrentDevice,
    sendData,
  };
}

export default useBLE;
