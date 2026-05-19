// 依賴瀏覽器全域 iztro / Solar / Lunar(由 vendor script 提供)

function buildChart(input) {
  const { name, gender, calendar, year, month, day, isLeapMonth, hourIndex } = input;

  let y, m, d;
  if (calendar === 'lunar') {
    const s = Lunar.fromYmd(year, isLeapMonth ? -month : month, day).getSolar();
    y = s.getYear(); m = s.getMonth(); d = s.getDay();
  } else {
    y = year; m = month; d = day;
  }

  const HOUR_HH = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const hh = HOUR_HH[hourIndex];

  const astro = iztro.astro.bySolar(`${y}-${m}-${d}`, hourIndex, gender, true, 'zh-TW');
  const horo = astro.horoscope('2026-7-1');
  const ec = Solar.fromYmdHms(y, m, d, hh, 0, 0).getLunar().getEightChar();

  return {
    name, gender,
    solarDate: `${y}-${m}-${d}`,
    lunarDate: astro.lunarDate,
    fiveElementsClass: astro.fiveElementsClass,
    soul: astro.soul, body: astro.body,
    palaces: astro.palaces.map(p => ({
      name: p.name,
      branch: p.earthlyBranch,
      majorStars: p.majorStars.map(s => ({ name: s.name, mutagen: s.mutagen || '' })),
      minorStars: p.minorStars.map(s => ({ name: s.name, mutagen: s.mutagen || '' })),
      adjStars:   p.adjectiveStars.map(s => s.name),
    })),
    bazi: { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), hour: ec.getTime() },
    liunian: {
      stem: horo.yearly.heavenlyStem,
      branch: horo.yearly.earthlyBranch,
      palaceName: horo.yearly.name,
      mutagen: horo.yearly.mutagen,
    },
  };
}

export { buildChart };
