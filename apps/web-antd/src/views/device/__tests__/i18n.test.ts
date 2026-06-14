import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

import {
  DEVICE_COMMAND_LABEL_KEY,
  DEVICE_COMMAND_SECTIONS,
  DEVICE_COMMANDS,
} from '#/components/device-commands';

/**
 * device i18n key 完整性 —— 守护「门禁盲区」（typecheck/eslint/build 都不校验运行时 i18n key）。
 *
 * 协议台复盘教训（[[protocol-lab-tests]]）：loadLocalesMapFromDir 用**原始文件名**做命名空间、
 * 不做 kebab→camel。文件名必须是 device.json（命名空间 device），与代码 $t('device.*') 一致。
 *
 * 本测试把「代码引用的每个 device.* key 必须在 zh-CN 与 en-US 中都存在」钉成断言。
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

const ROOT = resolve(process.cwd(), 'apps/web-antd/src');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function flatten(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const zh = flatten(JSON.parse(read('locales/langs/zh-CN/device.json')));
const en = flatten(JSON.parse(read('locales/langs/en-US/device.json')));

describe('device i18n —— 命名空间与 key 一致性', () => {
  it('locale 文件名即命名空间：必须是 device.json', () => {
    for (const lang of ['zh-CN', 'en-US']) {
      expect(
        existsSync(resolve(ROOT, `locales/langs/${lang}/device.json`)),
        `${lang}/device.json 缺失`,
      ).toBe(true);
    }
  });

  it('zh-CN 与 en-US 的 key 集合完全一致（无漂移）', () => {
    expect(Object.keys(zh).toSorted()).toEqual(Object.keys(en).toSorted());
  });

  it('两个语言包都含必备顶层段（menu/title）', () => {
    for (const k of ['menu', 'title']) {
      expect(zh[k], `zh 缺 ${k}`).toBeTruthy();
      expect(en[k], `en 缺 ${k}`).toBeTruthy();
    }
  });

  it(String.raw`zh 文案不含 Unicode 替换符 \uFFFD（防编码损坏）`, () => {
    for (const [k, v] of Object.entries(zh)) {
      expect(String(v).includes('�'), `zh.${k} 含损坏字符`).toBe(false);
    }
  });
});

describe('device i18n —— 代码引用的 key 必须存在', () => {
  const sources = [
    read('views/device/list.vue'),
    read('views/device/data.ts'),
    read('views/device/modules/device-operations.vue'),
    read('views/device/modules/device-detail.vue'),
    read('views/device/channel/list.vue'),
    read('views/device/channel/data.ts'),
    read('views/device/channel/modules/channel-form.vue'),
    read('router/routes/modules/device.ts'),
  ].join('\n');

  // 仅匹配带引号的静态 $t('device.xxx') 字面量（排除模板字面量动态 key）。
  const staticKeys = [
    ...new Set(
      [...sources.matchAll(/\$t\(['"]device\.([^'"]+)['"]/g)].map(
        (m) => m[1] ?? '',
      ),
    ),
  ];

  it.each(staticKeys)('静态引用 device.%s 在 zh/en 均存在', (key) => {
    expect(zh[key], `zh 缺 device.${key}`).toBeDefined();
    expect(en[key], `en 缺 device.${key}`).toBeDefined();
  });

  it('静态扫描确实命中了一批 key（防正则失效空跑）', () => {
    expect(staticKeys.length).toBeGreaterThan(20);
  });
});

describe('device i18n —— 共享命令面板的动态 key（DeviceCommandPanel）', () => {
  // DeviceCommandPanel 用 `${labelPrefix}.action.<code>` / `.section.<section>` 动态拼 key，
  // 静态扫描抓不到。此处直接对 DEVICE_COMMANDS 描述符断言，守住面板文案在 zh/en 都存在。
  it.each(DEVICE_COMMANDS.map((c) => c.code))(
    '命令 %s 的 device.action key 在 zh/en 均存在',
    (code) => {
      const key = `action.${DEVICE_COMMAND_LABEL_KEY[code] ?? code}`;
      expect(zh[key], `zh 缺 device.${key}`).toBeDefined();
      expect(en[key], `en 缺 device.${key}`).toBeDefined();
    },
  );

  it.each(DEVICE_COMMAND_SECTIONS)(
    '分组 %s 的 device.section key 在 zh/en 均存在',
    (section) => {
      const key = `section.${section}`;
      expect(zh[key], `zh 缺 device.${key}`).toBeDefined();
      expect(en[key], `en 缺 device.${key}`).toBeDefined();
    },
  );
});
