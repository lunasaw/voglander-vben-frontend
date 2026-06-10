import { describe, expect, it, vi } from 'vitest';

import {
  PTZ_DIRECTIONS,
  PTZ_ZOOM,
  TOPIC_META,
  topicColor,
  topicLabel,
} from '../data';

// $t 桩：直接回显 key，便于断言映射到了正确的 i18n 命名空间/后缀。
vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

/**
 * data.ts —— 展示元数据的纯函数与常量。
 *
 * 规格依据：GB28181-PROTOCOL-LAB-FRONTEND-PLAN.md §1.2（PTZ 词表）与 §1.3（topic 清单）。
 * 这些常量是前端与后端 PTZ_VOCAB / SSE topic 的契约镜像，必须逐条对齐，不得增删。
 */
describe('protocol-lab/data', () => {
  describe('pTZ 方向盘词表（对齐后端 PtzControlReq.command 注释）', () => {
    it('八向方向盘命令与 3×3 网格位置精确镜像后端词表', () => {
      const byKey = Object.fromEntries(
        PTZ_DIRECTIONS.map((b) => [b.command, b]),
      );
      // 后端支持：UP/DOWN/LEFT/RIGHT/UP_LEFT/UP_RIGHT/DOWN_LEFT/DOWN_RIGHT/STOP
      expect(Object.keys(byKey).sort()).toEqual(
        [
          'DOWN',
          'DOWN_LEFT',
          'DOWN_RIGHT',
          'LEFT',
          'RIGHT',
          'STOP',
          'UP',
          'UP_LEFT',
          'UP_RIGHT',
        ].sort(),
      );
      // STOP 居中（row2,col2），UP 居顶中（row1,col2），符合方向盘直觉
      expect(byKey.STOP).toMatchObject({ row: 2, col: 2 });
      expect(byKey.UP).toMatchObject({ row: 1, col: 2 });
      expect(byKey.DOWN_RIGHT).toMatchObject({ row: 3, col: 3 });
    });

    it('变倍按钮覆盖 ZOOM_IN / ZOOM_OUT', () => {
      expect(PTZ_ZOOM.map((b) => b.command).sort()).toEqual([
        'ZOOM_IN',
        'ZOOM_OUT',
      ]);
    });

    it('每个方向盘按钮都有唯一的 i18n key 与合法网格坐标', () => {
      const all = [...PTZ_DIRECTIONS, ...PTZ_ZOOM];
      const keys = all.map((b) => b.key);
      expect(new Set(keys).size).toBe(keys.length); // key 唯一
      for (const btn of all) {
        expect(btn.row).toBeGreaterThanOrEqual(1);
        expect(btn.col).toBeGreaterThanOrEqual(1);
        expect(btn.command).toMatch(/^[A-Z_]+$/); // 直发大写词
      }
    });
  });

  describe('topicLabel —— topic → i18n 标题', () => {
    it('已知 topic 映射到 protocolLab.event.<labelKey>（camelCase 命名空间）', () => {
      // $t 回显 key，故可断言拼装结果
      expect(topicLabel('device.register')).toBe('protocolLab.event.register');
      expect(topicLabel('clientcmd.ptz')).toBe('protocolLab.event.ptz');
      expect(topicLabel('clientcmd.register.fail')).toBe(
        'protocolLab.event.registerFail',
      );
    });

    it('未知 topic 回退原始 topic 字符串（不抛异常）', () => {
      expect(topicLabel('unknown.topic')).toBe('unknown.topic');
    });
  });

  describe('topicColor —— topic → Tag 颜色', () => {
    it('已知 topic 返回映射色，未知 topic 回退 default', () => {
      expect(topicColor('device.offline')).toBe('red');
      expect(topicColor('device.register')).toBe('green');
      expect(topicColor('nope.nope')).toBe('default');
    });
  });

  describe('tOPIC_META 契约完整性（对齐 §1.3 SSE 事件清单）', () => {
    it('覆盖全部右侧 device/session/alarm topic', () => {
      const required = [
        'device.register',
        'device.online',
        'device.offline',
        'device.keepalive',
        'device.catalog',
        'device.info',
        'session.invite_ok',
        'session.bye',
        'alarm.new',
      ];
      for (const t of required) {
        expect(TOPIC_META[t], `缺少 topic 映射: ${t}`).toBeDefined();
      }
    });

    it('覆盖全部左侧 clientcmd topic', () => {
      const required = [
        'clientcmd.register.ok',
        'clientcmd.register.fail',
        'clientcmd.register.challenge',
        'clientcmd.ptz',
        'clientcmd.record',
        'clientcmd.reboot',
        'clientcmd.iframe',
        'clientcmd.guard',
        'clientcmd.alarmreset',
        'clientcmd.query.catalog',
        'clientcmd.query.deviceinfo',
        'clientcmd.query.devicestatus',
        'clientcmd.config.basicparam',
        'clientcmd.broadcast',
        'clientcmd.invite',
      ];
      for (const t of required) {
        expect(TOPIC_META[t], `缺少 topic 映射: ${t}`).toBeDefined();
      }
    });

    it('每条 meta 都有 labelKey 与 color', () => {
      for (const [topic, meta] of Object.entries(TOPIC_META)) {
        expect(meta.labelKey, `${topic}.labelKey`).toBeTruthy();
        expect(meta.color, `${topic}.color`).toBeTruthy();
      }
    });
  });
});
