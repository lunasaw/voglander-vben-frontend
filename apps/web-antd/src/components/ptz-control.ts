/**
 * PTZ 方向盘共享常量。
 *
 * 从协议验证台 ServerPanel 提取，供「协议台」与「设备管理页」共用 PtzControl 组件。
 * 命令词表（command）大小写无关，由后端门面层 PTZ_VOCAB 翻译为规范枚举：
 *   UP/DOWN/LEFT/RIGHT/UP_LEFT/UP_RIGHT/DOWN_LEFT/DOWN_RIGHT/STOP/ZOOM_IN/ZOOM_OUT
 *
 * 这是前端与后端 PtzControlReq.command 的契约镜像，不得增删。
 */
export interface PtzButton {
  /** 后端词表（大小写无关）。 */
  command: string;
  /** i18n key 后缀（<labelPrefix>.<key>，默认 protocolLab.ptz.<key>）。 */
  key: string;
  /** 方向盘网格位置（3×3，row/col 从 1 起）。 */
  row: number;
  col: number;
}

export const PTZ_DIRECTIONS: PtzButton[] = [
  { command: 'UP_LEFT', key: 'upLeft', row: 1, col: 1 },
  { command: 'UP', key: 'up', row: 1, col: 2 },
  { command: 'UP_RIGHT', key: 'upRight', row: 1, col: 3 },
  { command: 'LEFT', key: 'left', row: 2, col: 1 },
  { command: 'STOP', key: 'stop', row: 2, col: 2 },
  { command: 'RIGHT', key: 'right', row: 2, col: 3 },
  { command: 'DOWN_LEFT', key: 'downLeft', row: 3, col: 1 },
  { command: 'DOWN', key: 'down', row: 3, col: 2 },
  { command: 'DOWN_RIGHT', key: 'downRight', row: 3, col: 3 },
];

export const PTZ_ZOOM: PtzButton[] = [
  { command: 'ZOOM_IN', key: 'zoomIn', row: 1, col: 1 },
  { command: 'ZOOM_OUT', key: 'zoomOut', row: 1, col: 2 },
];
