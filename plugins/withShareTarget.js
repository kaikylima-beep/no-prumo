// Faz o app aparecer no menu "Compartilhar" do Android para PDF e CSV (extratos, faturas, holerites).
const { withAndroidManifest } = require('expo/config-plugins');

const MIME = ['application/pdf', 'text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel'];

module.exports = function withShareTarget(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const main = app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    if (!main) return cfg;
    main['intent-filter'] = main['intent-filter'] || [];
    const already = main['intent-filter'].some((f) => (f.action || []).some((a) => a.$['android:name'] === 'android.intent.action.SEND'));
    if (!already) {
      main['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: MIME.map((m) => ({ $: { 'android:mimeType': m } })),
      });
    }
    return cfg;
  });
};
