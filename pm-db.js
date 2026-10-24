/* Pisto-Man · conexión con Firebase. La usan la app del dueño y la de repartidores.
   Da una base con la misma forma que usaba la app antes (collection, doc, where, onSnapshot, set, update),
   guarda en el celular sin internet y sube los cambios cuando vuelve la señal. */
(function(){
  'use strict';
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      var base = document.querySelector('meta[name="pm-base"]');
      var url = (base ? base.content : './') + 'sw.js';
      navigator.serviceWorker.register(url, { scope: base ? base.content : './' }).catch(function(e){ console.warn('sw', e); });
    });
  }

  var cfg = window.PM_FIREBASE || null;
  var PM = window.PM = { listo: false, cfg: cfg };
  if(!cfg || !cfg.apiKey || !cfg.projectId || !window.firebase){ return; }

  firebase.initializeApp(cfg);
  var fs = firebase.firestore();
  try{ fs.settings({ experimentalAutoDetectLongPolling: true, merge: true }); }catch(e){}
  PM.persistencia = fs.enablePersistence({ synchronizeTabs: true }).catch(function(e){ console.warn('Sin guardado en el celular:', e && e.code); });
  var FV = firebase.firestore.FieldValue;

  /* quita lo indefinido (Firestore no lo acepta) sin tocar los valores especiales como increment() */
  function limpiar(v){
    if(v === undefined) return undefined;
    if(v === null || typeof v !== 'object') return v;
    if(v instanceof FV) return v;
    if(Array.isArray(v)) return v.map(function(x){ var y = limpiar(x); return y === undefined ? null : y; });
    var o = {};
    for(var k in v){ if(Object.prototype.hasOwnProperty.call(v, k)){ var y = limpiar(v[k]); if(y !== undefined) o[k] = y; } }
    return o;
  }
  /* las escrituras no esperan al servidor: así la app no se queda cargando sin internet */
  function escribir(p){
    p.catch(function(e){ console.error('No se guardó:', e); window.dispatchEvent(new CustomEvent('pm-error-escritura', { detail: e })); });
    return Promise.resolve();
  }
  function doc(path){
    var ref = fs.doc(path);
    return {
      id: ref.id, path: path, ref: ref,
      get: function(){ return ref.get(); },
      set: function(x){ return escribir(ref.set(limpiar(x))); },
      update: function(x){ return escribir(ref.set(limpiar(x), { merge: true })); },
      delete: function(){ return escribir(ref.delete()); },
      onSnapshot: function(cb, err){ return ref.onSnapshot(cb, err); },
      collection: function(c){ return coleccion(path + '/' + c); }
    };
  }
  function consulta(q, path){
    return {
      where: function(a, o, v){ return consulta(q.where(a, o, v), path); },
      orderBy: function(a, b){ return consulta(q.orderBy(a, b), path); },
      limit: function(n){ return consulta(q.limit(n), path); },
      onSnapshot: function(cb, err){ return q.onSnapshot(cb, err); },
      get: function(){ return q.get(); },
      doc: function(id){ return doc(path + '/' + (id || fs.collection(path).doc().id)); }
    };
  }
  function coleccion(path){ return consulta(fs.collection(path), path); }

  PM.db = {
    doc: doc, collection: coleccion,
    inc: function(n){ return FV.increment(n); },
    ahora: function(){ return FV.serverTimestamp(); },
    fs: fs, FV: FV, limpiar: limpiar
  };
  PM.auth = firebase.auth();
  PM.listo = true;

  PM.mensajeError = function(e){
    var c = (e && e.code) || '';
    var m = {
      'auth/invalid-email': 'Revisa el correo, parece que está mal escrito.',
      'auth/user-not-found': 'No hay una cuenta con ese correo.',
      'auth/wrong-password': 'La contraseña no es correcta.',
      'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
      'auth/invalid-login-credentials': 'El correo o la contraseña no son correctos.',
      'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
      'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Usa Entrar.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 letras o números.',
      'auth/network-request-failed': 'No hay internet. Para entrar la primera vez necesitas señal.',
      'auth/operation-not-allowed': 'Falta activar Correo electrónico/contraseña en Firebase (Authentication).',
      'permission-denied': 'No tienes permiso para esto. Revisa que entraste con la cuenta correcta.',
      'unavailable': 'No hay conexión con el servidor. Revisa tu internet.'
    };
    return m[c] || ('Algo falló' + (c ? ' (' + c + ')' : '') + '. Intenta otra vez.');
  };

})();
