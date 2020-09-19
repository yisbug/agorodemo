import { createStore } from 'iostore';

createStore({
  namespace: 'RtcStore',
  joinState: 0, // 0未加入，1 加入中，2 已加入
  ids: [], // 加入视频的 id 列表

  update(params) {
    Object.keys(params).forEach(key => {
      this[key] = params[key];
    });
  },
});
