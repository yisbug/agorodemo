import React, { useState, useEffect } from 'react';
import { Layout, Form, Input, Button, Select, Radio, message } from 'antd';
import { useStore } from 'iostore';
import AgoraRTC from '../lib/AgoraRTC';

const { Option } = Select;
const { Header, Content } = Layout;
const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};
const tailLayout = {
  wrapperCol: {
    offset: 8,
    span: 16,
  },
};

const rtc = {
  client: null,
  published: false,
  localStream: null,
  remoteStreams: [],
  params: {},
};

function Join() {
  const [isShowAdvancedSetting, updateShowAdvancedSetting] = useState(false);
  const toggleShowAdvancedSetting = () => {
    updateShowAdvancedSetting(!isShowAdvancedSetting);
  };

  const { SettingStore, RtcStore } = useStore();
  useEffect(() => {
    SettingStore.getDevices();
  }, [SettingStore]);

  const unpublish = () => {
    if (!rtc.client) {
      message.error('Please Join Room First');
      return;
    }
    if (!rtc.published) {
      message.error("Your didn't publish");
      return;
    }
    const oldState = rtc.published;
    rtc.client.unpublish(rtc.localStream, err => {
      rtc.published = oldState;
      console.log('unpublish failed');
      message.error('unpublish failed');
      console.error(err);
    });
    message.info('unpublish');
    rtc.published = false;
  };

  const publish = () => {
    if (!rtc.client) {
      message.error('Please Join Room First');
      return;
    }
    if (rtc.published) {
      message.error('Your already published');
      return;
    }
    const oldState = rtc.published;

    // publish localStream
    rtc.client.publish(rtc.localStream, err => {
      rtc.published = oldState;
      console.log('publish failed');
      message.error('publish failed');
      console.error(err);
    });
    message.info('publish');
    rtc.published = true;
  };

  const handleEvents = () => {
    // Occurs when an error message is reported and requires error handling.
    rtc.client.on('error', err => {
      message.error(`get an error:${err.message}`);
      console.log(err);
    });
    // Occurs when the peer user leaves the channel; for example, the peer user calls Client.leave.
    rtc.client.on('peer-leave', evt => {
      const id = evt.uid;
      console.log('id', evt);
      const streams = rtc.remoteStreams.filter(e => id !== e.getId());
      const peerStream = rtc.remoteStreams.find(e => id === e.getId());
      if (peerStream && peerStream.isPlaying()) {
        peerStream.stop();
      }
      rtc.remoteStreams = streams;
      if (id !== rtc.params.uid) {
        const ids = RtcStore.ids.filter(item => item !== id);
        RtcStore.update({ ids });
      }
      message.info('peer leave');
      console.log('peer-leave', id);
    });
    // Occurs when the local stream is published.
    rtc.client.on('stream-published', () => {
      message.info('stream published success');
      console.log('stream-published');
    });
    // Occurs when the remote stream is added.
    rtc.client.on('stream-added', evt => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      message.info(`stream-added uid: ${id}`);
      if (id !== rtc.params.uid) {
        rtc.client.subscribe(remoteStream, err => {
          console.log('stream subscribe failed', err);
        });
      }
      console.log('stream-added remote-uid: ', id);
    });
    // Occurs when a user subscribes to a remote stream.
    rtc.client.on('stream-subscribed', evt => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      rtc.remoteStreams.push(remoteStream);
      const ids = RtcStore.ids.concat([id]);
      RtcStore.update({ ids });
      remoteStream.play(`remote_video_${id}`);
      message.info(`stream-subscribed remote-uid: ${id}`);
      console.log('stream-subscribed remote-uid: ', id);
    });
    // Occurs when the remote stream is removed; for example, a peer user calls Client.unpublish.
    rtc.client.on('stream-removed', evt => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      message.info(`stream-removed uid: ${id}`);
      if (remoteStream.isPlaying()) {
        remoteStream.stop();
      }
      rtc.remoteStreams = rtc.remoteStreams.filter(stream => {
        return stream.getId() !== id;
      });
      const ids = RtcStore.ids.filter(item => item !== id);
      RtcStore.update({ ids });
      console.log('stream-removed remote-uid: ', id);
    });
    rtc.client.on('onTokenPrivilegeWillExpire', () => {
      // After requesting a new token
      // rtc.client.renewToken(token);
      message.info('onTokenPrivilegeWillExpire');
      console.log('onTokenPrivilegeWillExpire');
    });
    rtc.client.on('onTokenPrivilegeDidExpire', () => {
      // After requesting a new token
      // client.renewToken(token);
      message.info('onTokenPrivilegeDidExpire');
      console.log('onTokenPrivilegeDidExpire');
    });
  };

  const onFinish = values => {
    console.log('values', values);
    if (!SettingStore.camera)
      return message.error('Not found the camera, plz check your browser setting.');
    if (!SettingStore.microphone)
      return message.error('Not found the microphone, plz check your browser setting.');
    SettingStore.update(values);
    rtc.client = AgoraRTC.createClient({ mode: SettingStore.mode, codec: SettingStore.codec });
    if (RtcStore.joinState === 1) {
      message.error('Your already joining');
      return;
    }
    if (RtcStore.joinState === 2) {
      message.error('Your already joined');
      return;
    }
    RtcStore.update({ joinState: 1 });

    handleEvents(rtc);
    rtc.client.init(
      SettingStore.appId,
      () => {
        message.info('init client success');
        rtc.client.join(
          SettingStore.token || null,
          SettingStore.channel,
          SettingStore.uid ? +SettingStore.uid : null,
          uid => {
            message.info(`join channel: ${SettingStore.channel} success, uid: ${uid}`);
            console.log(`join channel: ${SettingStore.channel} success, uid: ${uid}`);
            rtc.joined = true;
            rtc.params.uid = uid;
            // create local stream
            rtc.localStream = AgoraRTC.createStream({
              streamID: rtc.params.uid,
              audio: true,
              video: true,
              screen: false,
              microphoneId: SettingStore.microphone,
              cameraId: SettingStore.camera,
            });
            rtc.localStream.init(
              () => {
                console.log('init local stream success');
                // play stream with html element id "local_stream"
                rtc.localStream.play('local_stream');

                // publish local stream
                publish(rtc);
                RtcStore.update({ joinState: 2 });
              },
              err => {
                message.error('stream init failed, please open console see more detail');
                console.error('init local stream failed ', err);
                RtcStore.update({ joinState: 0 });
              }
            );
          },
          err => {
            message.error('client join failed, please open console see more detail');
            console.error('client join failed', err);
            RtcStore.update({ joinState: 0 });
          }
        );
      },
      err => {
        message.error('client init failed, please open console see more detail');
        console.error(err);
        RtcStore.update({ joinState: 0 });
      }
    );
  };

  const leave = () => {
    if (!rtc.client) {
      message.error('Please Join First!');
      return;
    }
    if (!rtc.joined) {
      message.error('You are not in channel');
      return;
    }
    /**
     * Leaves an AgoraRTC Channel
     * This method enables a user to leave a channel.
     * */
    rtc.client.leave(
      () => {
        // stop stream
        if (rtc.localStream.isPlaying()) {
          rtc.localStream.stop();
        }
        // close stream
        rtc.localStream.close();
        for (let i = 0; i < rtc.remoteStreams.length; i++) {
          const stream = rtc.remoteStreams.shift();
          if (stream.isPlaying()) {
            stream.stop();
          }
        }
        RtcStore.update({ ids: [] });
        rtc.localStream = null;
        rtc.remoteStreams = [];
        rtc.client = null;
        console.log('client leaves channel success');
        rtc.published = false;
        rtc.joined = false;
        message.info('leave success');
      },
      err => {
        console.log('channel leave failed');
        message.error('leave success');
        console.error(err);
      }
    );
  };

  return (
    <Layout>
      <Header>
        <h1 style={{ color: '#fff' }}>Basic Communication</h1>
      </Header>
      <Content>
        <div style={{ width: '600px', marginTop: '20px' }}>
          <Form
            {...layout}
            name="basic"
            initialValues={{
              // appId: '80e2dcccc76147bc90924792cf0044b5',
              // channel: 'test',
              // token:
              //   '00680e2dcccc76147bc90924792cf0044b5IAA5f9K5nWamx7/brp2+STYCkaZ2IKbkVwUf8hRv+uyplgx+f9gAAAAAEAAQz9mbaStnXwEAAQBpK2df',
              appId: '',
              channel: '',
              token: '',
            }}
            onFinish={onFinish}
          >
            <Form.Item
              label="App ID"
              name="appId"
              rules={[
                {
                  required: true,
                  message: 'Please input your appId!',
                },
              ]}
            >
              <Input placeholder="App ID" />
            </Form.Item>

            <Form.Item
              label="Channel"
              name="channel"
              rules={[
                {
                  required: true,
                  message: 'Please input the channel!',
                },
              ]}
            >
              <Input placeholder="channel" />
            </Form.Item>

            <Form.Item
              label="Token"
              name="token"
              rules={[
                {
                  required: true,
                  message: 'Please input the token!',
                },
              ]}
            >
              <Input placeholder="token" />
            </Form.Item>

            <Form.Item {...tailLayout}>
              <Button type="primary" htmlType="submit" style={{ marginRight: 10 }}>
                JOIN
              </Button>
              <Button type="primary" style={{ marginRight: 10 }} onClick={leave}>
                LEAVE
              </Button>
              <Button type="primary" style={{ marginRight: 10 }} onClick={publish}>
                PUBLISH
              </Button>
              <Button type="primary" onClick={unpublish}>
                UNPUBLISH
              </Button>
            </Form.Item>
            <Form.Item {...tailLayout}>
              <Button type="primary" onClick={() => toggleShowAdvancedSetting()}>
                ADVANCED SETTINGS
              </Button>
            </Form.Item>
          </Form>

          <Form
            {...layout}
            name="basic"
            initialValues={{
              uid: SettingStore.uid,
              camera: SettingStore.camera,
              cameraResolution: SettingStore.cameraResolution,
              mode: SettingStore.mode,
              codec: SettingStore.codec,
            }}
            style={{ display: isShowAdvancedSetting ? 'block' : 'none' }}
          >
            <Form.Item label="UID" name="uid">
              <Input placeholder="UID" />
            </Form.Item>
            <Form.Item label="CAMERA" name="camera">
              <Select
                value={SettingStore.camera}
                onChange={val => {
                  SettingStore.update({ camera: val });
                }}
              >
                {SettingStore.devices
                  .filter(item => item.kind === 'videoinput')
                  .map(item => {
                    return (
                      <Option value={item.deviceId} key={item.deviceId}>
                        {item.label}
                      </Option>
                    );
                  })}
              </Select>
            </Form.Item>
            <Form.Item label="MICROPHONE" name="microphone">
              <Select
                value={SettingStore.microphone}
                onChange={val => {
                  SettingStore.update({ microphone: val });
                }}
              >
                {SettingStore.devices
                  .filter(item => item.kind === 'audioinput')
                  .map(item => {
                    return (
                      <Option value={item.deviceId} key={item.deviceId}>
                        {item.label}
                      </Option>
                    );
                  })}
              </Select>
            </Form.Item>
            <Form.Item label="CAMERA RESOLUTION" name="cameraResolution">
              <Select
                onChange={val => {
                  SettingStore.update({ cameraResolution: val });
                }}
              >
                <Option value="default">default</Option>
                <Option value="480p">480p</Option>
                <Option value="720p">720p</Option>
                <Option value="1080p">1080p</Option>
              </Select>
            </Form.Item>
            <Form.Item name="mode" label="MODE">
              <Radio.Group
                onChange={val => {
                  SettingStore.update({ mode: val });
                }}
              >
                <Radio value="live">live</Radio>
                <Radio value="rtc">rtc</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="codec" label="CODEC">
              <Radio.Group
                onChange={val => {
                  SettingStore.update({ codec: val });
                }}
              >
                <Radio value="h264">h264</Radio>
                <Radio value="vp8">vp8</Radio>
              </Radio.Group>
            </Form.Item>
          </Form>

          <div className="video-grid" id="video">
            <div className="video-view">
              <div id="local_stream" className="video-placeholder" style={{ height: 400 }} />
              <div id="local_video_info" className="video-profile hide" />
              <div id="video_autoplay_local" className="autoplay-fallback hide" />
            </div>
            {RtcStore.ids.map(id => {
              return (
                <div id={`remote_video_panel_${id}`} className="video-view" key={id}>
                  <div
                    id={`remote_video_${id}`}
                    className="video-placeholder"
                    style={{ height: 400 }}
                  />
                  <div id={`remote_video_info_${id}`} className="video-profile hide" />
                  <div id={`video_autoplay_${id}`} className="autoplay-fallback hide" />
                </div>
              );
            })}
          </div>
        </div>
      </Content>
    </Layout>
  );
}

export default Join;
