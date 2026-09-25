// ══════════════════════════════════════════════════════════════════════════
// Script de Google Apps Script que manda el correo de info@tirorirohome.com
// al CRM. Se pega UNA vez en script.google.com con la sesión de info@ (sin
// claves de Google Cloud ni permisos de terceros: corre dentro de la cuenta).
//
// Cada 5 minutos busca los correos nuevos de la bandeja de entrada y los
// enviados (sin promociones, redes sociales ni foros) y los manda a
// /api/correo/entrada. La primera vez manda también los últimos 30 días como
// historial (solo se enlazan y resumen; no generan propuestas). El filtrado
// fino (avisos automáticos, proveedores…) lo hace el CRM.
// ══════════════════════════════════════════════════════════════════════════

export function appsScriptCorreo(opts: { url: string; token: string; cuenta: string }): string {
  return `// Tiroriro CRM · correo de ${opts.cuenta} → bandeja de mensajes del CRM
// 1) Pega esto en https://script.google.com (con la sesión de ${opts.cuenta}).
// 2) Elige la función «instalar» y pulsa Ejecutar. Acepta los permisos.
// Listo: cada 5 minutos se mandan los correos nuevos al CRM.

const CRM_URL = ${JSON.stringify(opts.url)};
const CRM_TOKEN = ${JSON.stringify(opts.token)};
const CUENTA = ${JSON.stringify(opts.cuenta)};
const DIAS_HISTORIAL = 30;

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarCorreosAlCrm') ScriptApp.deleteTrigger(t);
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('instalado')) props.setProperty('instalado', String(Date.now()));
  ScriptApp.newTrigger('enviarCorreosAlCrm').timeBased().everyMinutes(5).create();
  enviarCorreosAlCrm();
}

function enviarCorreosAlCrm() {
  const props = PropertiesService.getScriptProperties();
  const instalado = Number(props.getProperty('instalado')) || Date.now();
  const desde = Number(props.getProperty('desde')) || (instalado - DIAS_HISTORIAL * 86400000);
  const dias = Math.max(1, Math.ceil((Date.now() - desde) / 86400000) + 1);
  const consulta = '(in:inbox OR in:sent) newer_than:' + dias + 'd -category:promotions -category:social -category:forums -in:chats';

  const mensajes = [];
  let maximo = desde;
  for (let inicio = 0; inicio < 1000; inicio += 100) {
    const hilos = GmailApp.search(consulta, inicio, 100);
    hilos.forEach(function (hilo) {
      hilo.getMessages().forEach(function (m) {
        const t = m.getDate().getTime();
        // 15 min de solape por si Gmail tarda en indexar (el CRM ignora los repetidos).
        if (t <= desde - 900000 || m.isDraft()) return;
        let lista = '';
        try { lista = m.getHeader('List-Unsubscribe'); } catch (e) { lista = ''; }
        mensajes.push({
          id: m.getId(), hilo: hilo.getId(), fecha: m.getDate().toISOString(),
          de: m.getFrom(), para: m.getTo(), cc: m.getCc(), asunto: m.getSubject(),
          texto: (m.getPlainBody() || '').slice(0, 20000),
          listUnsubscribe: !!lista, historial: t < instalado,
        });
        if (t > maximo) maximo = t;
      });
    });
    if (hilos.length < 100) break;
  }

  mensajes.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  for (let i = 0; i < mensajes.length; i += 50) {
    const res = UrlFetchApp.fetch(CRM_URL, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-whatsapp-token': CRM_TOKEN },
      payload: JSON.stringify({ cuenta: CUENTA, instalado: new Date(instalado).toISOString(), mensajes: mensajes.slice(i, i + 50) }),
    });
    if (res.getResponseCode() !== 200) throw new Error('El CRM respondió ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  // Solo se avanza la marca si todo llegó bien (si no, se reintenta en 5 minutos).
  props.setProperty('desde', String(maximo));
}
`;
}
