import { createStore } from 'iostore';
import AgoraRTC from '../lib/AgoraRTC';

createStore({
  namespace: 'SettingStore',
  appId: '',
  channel: '',
  token: '',
  uid: '',
  camera: '',
  microphone: '',
  cameraResolution: 'default',
  mode: 'live',
  codec: 'h264',

  isCheckedPermission: false,
  videoPermission: false,
  audioPermission: false,
  devices: [],
  update(params) {
    Object.keys(params).forEach(key => {
      this[key] = params[key];
    });
  },

  async checkPermission() {
    if (this.isCheckedPermission) return;
    const tempAudioStream = AgoraRTC.createStream({ audio: true, video: false });
    const tempVideoStream = AgoraRTC.createStream({ audio: false, video: true });
    const audioPermissionOK = new Promise(resolve => {
      tempAudioStream.init(() => resolve(), resolve);
    });
    const videoPermissionOK = new Promise(resolve => {
      tempVideoStream.init(() => resolve(), resolve);
    });
    const res = await Promise.all([audioPermissionOK, videoPermissionOK]);
    if (!res[0]) this.audioPermission = true;
    if (!res[1]) this.videoPermission = true;
    tempAudioStream.close();
    tempVideoStream.close();
    this.isCheckedPermission = true;
  },

  async getDevices() {
    await this.checkPermission();
    return new Promise(resolve => {
      AgoraRTC.getDevices(info => {
        this.devices = info;
        if (!this.camera) {
          this.camera =
            (this.devices.filter(item => item.kind === 'videoinput')[0] || {}).deviceId || '';
        }
        if (!this.microphone) {
          this.microphone =
            (this.devices.filter(item => item.kind === 'audioinput')[0] || {}).deviceId || '';
        }
        console.log('get the devices', info, this.camera, this.microphone);
        resolve(this.devices);
      });
    });
  },
});
