import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

/**
 * i18n key 完整性 —— 守护文档 §0/§3 记录的「门禁盲区」。
 *
 * 背景：typecheck / eslint / build 都不校验 i18n 运行时 key 是否存在。历史上
 * 文件名误用 `protocol-lab.json`（命名空间 protocol-lab）而代码引用 `protocolLab.*`，
 * 导致三道门禁全绿、页面 51 处文案却渲染成原始 key 串。
 *
 * 本测试把「代码引用的每个 protocolLab.* key 必须在 zh-CN 与 en-US 中都存在」钉成断言，
 * 让这类只能靠肉眼 dev 实跑才能发现的缺陷在 CI 单测阶段即暴露。
 */

vi.mock('#/locales', () => ({ $t: (k: string) => k }));

// vitest 从仓库根目录运行；据此定位源码与 locale 文件（绝对路径，稳定）。
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

const zh = flatten(JSON.parse(read('locales/langs/zh-CN/protocolLab.json')));
const en = flatten(JSON.parse(read('locales/langs/en-US/protocolLab.json')));

describe('protocolLab i18n —— 命名空间与 key 一致性', () => {
  it('locale 文件名即命名空间：必须是 protocolLab.json（camelCase）', () => {
    // 文档 §0/§3 根因：loadLocalesMapFromDir 用原始文件名作命名空间、不做 kebab→camel。
    // 代码统一引用 protocolLab.*，故文件名必须是 protocolLab.json；旧的 protocol-lab.json 必须不存在。
    for (const lang of ['zh-CN', 'en-US']) {
      expect(
        existsSync(resolve(ROOT, `locales/langs/${lang}/protocolLab.json`)),
        `${lang}/protocolLab.json 缺失`,
      ).toBe(true);
      expect(
        existsSync(resolve(ROOT, `locales/langs/${lang}/protocol-lab.json`)),
        `${lang}/protocol-lab.json 仍存在（命名空间会变回 protocol-lab，全部引用 miss）`,
      ).toBe(false);
    }
  });

  it('zh-CN 与 en-US 的 key 集合完全一致（无漂移）', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('两个语言包都含必备顶层段（title/menu/desc）', () => {
    for (const k of ['title', 'menu', 'desc']) {
      expect(zh[k], `zh 缺 ${k}`).toBeTruthy();
      expect(en[k], `en 缺 ${k}`).toBeTruthy();
    }
  });
});

describe('protocolLab i18n —— 代码引用的 key 必须存在', () => {
  // 源码里静态出现的 protocolLab.* 引用（含 $t('...') 与路由 meta）。
  const sources = [
    read('views/protocol-lab/index.vue'),
    read('views/protocol-lab/data.ts'),
    read('views/protocol-lab/components/ClientPanel.vue'),
    read('views/protocol-lab/components/ServerPanel.vue'),
    read('views/protocol-lab/components/SipTimeline.vue'),
    read('router/routes/modules/protocol-lab.ts'),
  ].join('\n');

  // 仅匹配带引号的静态 $t('protocolLab.xxx') 字面量：
  //  - 排除模板字面量 $t(`protocolLab.ptz.${x}`)（反引号，动态 key 另测）
  //  - 排除路由 name: 'protocolLab.gb28181'（非 $t 调用，非 i18n key）
  const staticKeys = [
    ...new Set(
      [...sources.matchAll(/\$t\(['"]protocolLab\.([^'"]+)['"]/g)].map(
        (m) => m[1] ?? '',
      ),
    ),
  ];

  it.each(staticKeys)('静态引用 protocolLab.%s 在 zh/en 均存在', (key) => {
    expect(zh[key], `zh 缺 protocolLab.${key}`).toBeDefined();
    expect(en[key], `en 缺 protocolLab.${key}`).toBeDefined();
  });

  it('静态扫描确实命中了一批 key（防正则失效空跑）', () => {
    expect(staticKeys.length).toBeGreaterThan(20);
  });
});

describe('protocolLab i18n —— 动态拼接的 key 必须存在', () => {
  it('pTZ 方向盘每个 button.key → protocolLab.ptz.<key>', async () => {
    const { PTZ_DIRECTIONS, PTZ_ZOOM } = await import('../data');
    for (const btn of [...PTZ_DIRECTIONS, ...PTZ_ZOOM]) {
      const k = `ptz.${btn.key}`;
      expect(zh[k], `zh 缺 ${k}`).toBeDefined();
      expect(en[k], `en 缺 ${k}`).toBeDefined();
    }
  });

  it('tOPIC_META 每个 labelKey → protocolLab.event.<labelKey>', async () => {
    const { TOPIC_META } = await import('../data');
    for (const meta of Object.values(TOPIC_META)) {
      const k = `event.${meta.labelKey}`;
      expect(zh[k], `zh 缺 ${k}`).toBeDefined();
      expect(en[k], `en 缺 ${k}`).toBeDefined();
    }
  });

  it('sSE 状态徽标四态 → protocolLab.sse.<state> 齐全', () => {
    for (const k of [
      'sse.connecting',
      'sse.reconnecting',
      'sse.connected',
      'sse.closed',
    ]) {
      expect(zh[k], `zh 缺 ${k}`).toBeDefined();
      expect(en[k], `en 缺 ${k}`).toBeDefined();
    }
  });
});
