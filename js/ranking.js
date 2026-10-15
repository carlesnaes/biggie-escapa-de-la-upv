// Ranking global con Supabase (su API REST con fetch)
var SUPABASE_URL = 'https://cyvzjrvvyjyuhegcfeuv.supabase.co';
var SUPABASE_KEY = 'sb_publishable_m6ddvecxdvlvpgh3_H2RMQ_z7dQxZq1';
var RANKING_SIZE = 5;
var PLAYER_NAME_KEY = 'infiltracionNombre';

function rankingConfigured()
{
  return SUPABASE_URL !== '' && SUPABASE_KEY !== '';
}

// La clave publishable va en la cabecera apikey
function rankingHeaders(extra)
{
  var headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  if (SUPABASE_KEY.indexOf('eyJ') === 0) {
    headers.Authorization = 'Bearer ' + SUPABASE_KEY;
  }
  for (var key in extra) headers[key] = extra[key];
  return headers;
}

function checkResponse(response)
{
  if (!response.ok) throw new Error('Supabase respondio ' + response.status);
  return response;
}

// Top 5, de menor a mayor tiempo
function fetchRanking()
{
  var url = SUPABASE_URL + '/rest/v1/ranking?select=nombre,tiempo' +
    '&order=tiempo.asc&limit=' + RANKING_SIZE;
  return fetch(url, { headers: rankingHeaders() })
    .then(checkResponse)
    .then(function(response) { return response.json(); });
}

// Guarda el tiempo y devuelve el puesto
function submitScore(name, time)
{
  return fetch(SUPABASE_URL + '/rest/v1/ranking', {
    method: 'POST',
    headers: rankingHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ nombre: name, tiempo: time })
  })
    .then(checkResponse)
    .then(function() { return fetchPosition(time); });
}

// Puesto = tiempos mejores + 1 (viene en content-range)
function fetchPosition(time)
{
  var url = SUPABASE_URL + '/rest/v1/ranking?select=id&tiempo=lt.' + time + '&limit=1';
  return fetch(url, { headers: rankingHeaders({ Prefer: 'count=exact' }) })
    .then(checkResponse)
    .then(function(response) {
      var range = response.headers.get('content-range') || '';
      var better = parseInt(range.split('/')[1], 10);
      return isNaN(better) ? null : better + 1;
    });
}

// Lista del ranking en la pantalla de inicio
function showRanking()
{
  var list = document.getElementById('ranking-list');
  var status = document.getElementById('ranking-status');
  list.textContent = '';

  if (!rankingConfigured()) {
    status.textContent = 'Ranking global no configurado.';
    return;
  }

  status.textContent = 'Cargando ranking…';
  fetchRanking().then(function(rows) {
    status.textContent = rows.length === 0 ? 'Aún no hay tiempos. ¡Sé el primero!' : '';
    rows.forEach(function(row) {
      var item = document.createElement('li');
      var name = document.createElement('span');
      var time = document.createElement('span');
      // textContent para que nadie meta html con el nombre
      name.textContent = row.nombre;
      time.textContent = formatTime(row.tiempo);
      item.appendChild(name);
      item.appendChild(time);
      list.appendChild(item);
    });
  }).catch(function(error) {
    console.error('No se pudo cargar el ranking', error);
    status.textContent = 'No se pudo cargar el ranking.';
  });
}

// Nombre sin espacios de mas y como mucho 16 letras
function cleanPlayerName(text)
{
  return text.replace(/\s+/g, ' ').trim().slice(0, 16);
}

function loadPlayerName()
{
  try {
    return window.localStorage.getItem(PLAYER_NAME_KEY) || '';
  } catch (error) {
    return '';
  }
}

function savePlayerName(name)
{
  try {
    window.localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch (error) {
  }
}
