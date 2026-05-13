import {
  claudeColors,
  claudeFonts,
  claudeRadius,
  claudeShadows,
  claudeTokens,
} from './claude-tokens';

describe('claudeColors', () => {
  it('defines all primary color roles', () => {
    expect(claudeColors.parchment).toBe('#f5f4ed');
    expect(claudeColors.ivory).toBe('#faf9f5');
    expect(claudeColors.terracotta).toBe('#c96442');
    expect(claudeColors.nearBlack).toBe('#141413');
    expect(claudeColors.oliveGray).toBe('#5e5d59');
    expect(claudeColors.stoneGray).toBe('#87867f');
    expect(claudeColors.borderCream).toBe('#f0eee6');
    expect(claudeColors.warmSand).toBe('#e8e6dc');
    expect(claudeColors.charcoalWarm).toBe('#4d4c48');
    expect(claudeColors.darkSurface).toBe('#30302e');
    expect(claudeColors.warmSilver).toBe('#b0aea5');
  });

  it('defines primary state colors', () => {
    expect(claudeColors.primaryHover).toBe('#d97757');
    expect(claudeColors.primaryActive).toBe('#b05535');
    expect(claudeColors.primaryBg).toBe('#faf0eb');
  });

  it('defines functional colors', () => {
    expect(claudeColors.success).toBe('#4a7c3f');
    expect(claudeColors.error).toBe('#b53333');
    expect(claudeColors.warning).toBe('#B07800');
  });

  it('defines border variants', () => {
    expect(claudeColors.borderWarm).toBe('#e8e6dc');
    expect(claudeColors.borderDark).toBe('#30302e');
  });

  it('defines ring colors', () => {
    expect(claudeColors.ringWarm).toBe('#d1cfc5');
    expect(claudeColors.ringSubtle).toBe('#dedc01');
    expect(claudeColors.ringDeep).toBe('#c2c0b6');
  });
});

describe('claudeShadows', () => {
  it('defines 5 shadow levels', () => {
    expect(claudeShadows.flat).toBe('none');
    expect(claudeShadows.contained).toContain('1px solid');
    expect(claudeShadows.ring).toContain('0px 0px 0px 1px');
    expect(claudeShadows.whisper).toContain('rgba');
    expect(claudeShadows.inset).toContain('inset');
  });
});

describe('claudeRadius', () => {
  it('defines 5 radius levels in ascending order', () => {
    expect(claudeRadius.sm).toBe(4);
    expect(claudeRadius.md).toBe(8);
    expect(claudeRadius.lg).toBe(12);
    expect(claudeRadius.xl).toBe(16);
    expect(claudeRadius.xxl).toBe(32);
  });

  it('orders radius: sm < md < lg < xl < xxl', () => {
    const values = [
      claudeRadius.sm,
      claudeRadius.md,
      claudeRadius.lg,
      claudeRadius.xl,
      claudeRadius.xxl,
    ];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('claudeFonts', () => {
  it('defines heading font stack containing serif fonts', () => {
    expect(claudeFonts.heading).toContain('STSongti SC');
    expect(claudeFonts.heading).toContain('Georgia');
    expect(claudeFonts.heading).toContain('serif');
  });

  it('defines body font stack as system sans-serif', () => {
    expect(claudeFonts.body).toContain('PingFang SC');
    expect(claudeFonts.body).toContain('sans-serif');
  });
});

describe('claudeTokens (combined)', () => {
  it('groups colors, shadows, radius, and fonts', () => {
    expect(claudeTokens.colors).toBe(claudeColors);
    expect(claudeTokens.shadows).toBe(claudeShadows);
    expect(claudeTokens.radius).toBe(claudeRadius);
    expect(claudeTokens.fonts).toBe(claudeFonts);
  });
});
