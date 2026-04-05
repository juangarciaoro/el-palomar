'use strict';

const Alexa  = require('ask-sdk');
const https  = require('https');
const crypto = require('crypto');

// --- Service Account ----------------------------------------------------------
let _sa = null;
function getSA() {
  if (_sa) return _sa;
  _sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (_sa.private_key) _sa.private_key = _sa.private_key.replace(/\\n/g, '\n');
  return _sa;
}

// --- OAuth2 token -------------------------------------------------------------
let _tokenCache = null;
async function getToken() {
  if (_tokenCache && _tokenCache.exp > Date.now() + 60000) return _tokenCache.tok;
  const sa  = getSA();
  const now = Math.floor(Date.now() / 1000);
  const hdr = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const pay = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })).toString('base64url');
  const sig = crypto.createSign('RSA-SHA256').update(hdr+'.'+pay).sign(sa.private_key, 'base64url');
  const jwt  = hdr+'.'+pay+'.'+sig;
  const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion='+jwt;
  const res  = await req('POST', 'oauth2.googleapis.com', '/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
  console.log('Token OK');
  _tokenCache = { tok: res.access_token, exp: Date.now() + (res.expires_in - 60) * 1000 };
  return _tokenCache.tok;
}

// --- HTTPS helper -------------------------------------------------------------
function req(method, hostname, path, hdrs, body) {
  return new Promise((resolve, reject) => {
    const buf = body ? Buffer.from(body, 'utf8') : null;
    const r = https.request({ hostname, path, method,
      headers: { ...hdrs, ...(buf ? { 'Content-Length': buf.length } : {}) },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { resolve({}); } });
    });
    r.on('error', reject);
    if (buf) r.write(buf);
    r.end();
  });
}

// --- Firestore REST -----------------------------------------------------------
const PROJECT = process.env.FIREBASE_PROJECT_ID;
const FS = 'firestore.googleapis.com';
const FP = () => '/v1/projects/'+PROJECT+'/databases/(default)/documents';

function fv(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fv) } };
  return { mapValue: { fields: ff(v) } };
}
function ff(obj) {
  const f = {};
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) f[k] = fv(v);
  return f;
}
function rv(v) {
  if (v.stringValue  !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue  !== undefined) return v.doubleValue;
  if (v.nullValue    !== undefined) return null;
  if (v.arrayValue)  return (v.arrayValue.values || []).map(rv);
  if (v.mapValue)    return rf(v.mapValue.fields || {});
  return null;
}
function rf(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) o[k] = rv(v);
  return o;
}

async function fsGetAll(col) {
  const tok = await getToken();
  console.log('fsGetAll', col);
  const res = await req('GET', FS, FP()+'/'+col, { Authorization: 'Bearer '+tok });
  if (!res.documents) return [];
  return res.documents.map(d => {
    const parts = d.name.split('/');
    return { id: parts[parts.length - 1], ...rf(d.fields || {}) };
  });
}

async function fsSet(col, id, data) {
  const tok = await getToken();
  console.log('fsSet', col+'/'+id);
  return req('PATCH', FS, FP()+'/'+col+'/'+id,
    { Authorization: 'Bearer '+tok, 'Content-Type': 'application/json' },
    JSON.stringify({ fields: ff(data) }));
}

async function fsUpdate(col, id, data) {
  const tok    = await getToken();
  const fields = ff(data);
  const mask   = Object.keys(fields).map(k => 'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');
  return req('PATCH', FS, FP()+'/'+col+'/'+id+'?'+mask,
    { Authorization: 'Bearer '+tok, 'Content-Type': 'application/json' },
    JSON.stringify({ fields }));
}

async function fsDelete(col, id) {
  const tok = await getToken();
  return req('DELETE', FS, FP()+'/'+col+'/'+id, { Authorization: 'Bearer '+tok });
}

// --- Helpers ------------------------------------------------------------------
function genId(p) { return p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2, 6); }
function isMatch(a, b) {
  const n = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const la = n(a), lb = n(b);
  return la.includes(lb) || lb.includes(la);
}
function joinList(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
}

// --- Handlers -----------------------------------------------------------------
const LaunchHandler = {
  canHandle(h) { return Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest'; },
  handle(h) {
    return h.responseBuilder
      .speak('Te escucho, palomita.')
      .reprompt('Di un comando. Por ejemplo: añade leche a la lista de la compra.')
      .getResponse();
  },
};

const AddShoppingHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
           Alexa.getIntentName(h.requestEnvelope) === 'AddShoppingItemIntent';
  },
  async handle(h) {
    const name = h.requestEnvelope.request.intent.slots?.producto?.value;
    if (!name) return h.responseBuilder.speak('Que producto quieres añadir?').getResponse();
    const [allCompra, allProductos] = await Promise.all([fsGetAll('compra'), fsGetAll('productos')]);
    const existing = allCompra.filter(i => !i.checked).find(i => isMatch(i.name, name));
    const reprompt = 'Que mas necesitas?';
    if (existing) {
      const newUnits = (existing.units || 1) + 1;
      await fsUpdate('compra', existing.id, { units: newUnits });
      return h.responseBuilder.speak(existing.name+' ya estaba en la lista. He actualizado la cantidad a '+newUnits+'.').reprompt(reprompt).getResponse();
    }
    const prodMatch = allProductos.find(p => isMatch(p.name, name));
    let cat;
    if (prodMatch) {
      cat = prodMatch.cat || '\uD83E\uDDFE Varios';
    } else {
      cat = '\uD83E\uDDFE Varios';
      const docId = name.trim().toLowerCase().replace(/\//g, '_').replace(/\./g, '_').slice(0, 100);
      await fsSet('productos', docId, { name: name.trim(), cat, createdAt: new Date() });
    }
    await fsSet('compra', genId('item'), { name, units: 1, cat, checked: false, addedBy: 'Alexa', createdAt: new Date() });
    return h.responseBuilder.speak('A\u00f1adido '+name+' a la lista de la compra.').reprompt(reprompt).getResponse();
  },
};

const RemoveShoppingHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
           Alexa.getIntentName(h.requestEnvelope) === 'RemoveShoppingItemIntent';
  },
  async handle(h) {
    const name = h.requestEnvelope.request.intent.slots?.producto?.value;
    if (!name) return h.responseBuilder.speak('Que producto quieres eliminar?').getResponse();
    const match = (await fsGetAll('compra')).filter(i => !i.checked).find(i => isMatch(i.name, name));
    const reprompt = 'Que mas necesitas?';
    if (!match) return h.responseBuilder.speak('No encontre '+name+' en la lista.').reprompt(reprompt).getResponse();
    await fsDelete('compra', match.id);
    return h.responseBuilder.speak('Eliminado '+match.name+' de la lista.').reprompt(reprompt).getResponse();
  },
};

const ListShoppingHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
           Alexa.getIntentName(h.requestEnvelope) === 'ListShoppingIntent';
  },
  async handle(h) {
    const items = (await fsGetAll('compra')).filter(i => !i.checked);
    const reprompt = 'Que mas necesitas?';
    if (!items.length) return h.responseBuilder.speak('La lista de la compra esta vacia.').reprompt(reprompt).getResponse();
    const names = items.map(i => i.name);
    const c = names.length;
    return h.responseBuilder.speak('Tienes '+c+' producto'+(c!==1?'s':'')+' pendiente'+(c!==1?'s':'')+': '+joinList(names)+'.').reprompt(reprompt).getResponse();
  },
};

const HelpHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
           Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(h) {
    return h.responseBuilder
      .speak('Puedes añadir o eliminar productos de la lista de la compra, o pedirme que te la lea. Que quieres hacer?')
      .reprompt('Que quieres hacer?').getResponse();
  },
};

const StopHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
           ['AMAZON.StopIntent','AMAZON.CancelIntent'].includes(Alexa.getIntentName(h.requestEnvelope));
  },
  handle(h) { return h.responseBuilder.speak('Hasta luego!').getResponse(); },
};

const SessionEndedHandler = {
  canHandle(h) { return Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest'; },
  handle(h)    { return h.responseBuilder.getResponse(); },
};

const ErrorHandler = {
  canHandle() { return true; },
  handle(h, err) {
    console.error('Error:', err.message, err.stack);
    return h.responseBuilder.speak('Lo siento, ha ocurrido un error. Intentalo de nuevo.').getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchHandler,
    AddShoppingHandler, RemoveShoppingHandler, ListShoppingHandler,
    HelpHandler, StopHandler, SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
