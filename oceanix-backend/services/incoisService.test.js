import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getMarineParameters,
  getSST,
  IncoisRequestError,
} from './incoisService.js'

const catalog = {
  table: {
    columnNames: ['datasetID', 'title', 'summary', 'minTime', 'maxTime'],
    rows: [
      ['verified_sst_dataset', 'Sea Surface Temperature', 'sea surface temperature', '2026-09-14T00:00:00Z', '2026-09-15T00:00:00Z'],
      ['verified_wave_dataset', 'Significant Wave Height', 'significant wave height', '2026-09-14T00:00:00Z', '2026-09-15T00:00:00Z'],
      ['verified_current_dataset', 'Surface Current', 'surface current eastward northward', '2026-09-14T00:00:00Z', '2026-09-15T00:00:00Z'],
    ],
  },
}

function infoPayload(variables) {
  const rows = [
    ['dimension', 'time', 'actual_range', '2026-09-14T00:00:00Z,2026-09-15T00:00:00Z'],
    ['dimension', 'latitude', 'actual_range', '0,25'],
    ['dimension', 'longitude', 'actual_range', '65,95'],
  ]

  for (const variable of variables) {
    rows.push(['variable', variable.name, 'standard_name', variable.standardName])
    rows.push(['variable', variable.name, 'units', variable.unit])
  }

  return {
    table: {
      columnNames: ['row_type', 'variable_name', 'attribute_name', 'value'],
      rows,
    },
  }
}

function successfulFetch(url) {
  const body = url.includes('/tabledap/allDatasets')
    ? catalog
    : url.includes('/info/verified_sst_dataset/')
      ? infoPayload([{ name: 'sst', standardName: 'sea_surface_temperature', unit: 'degree_Celsius' }])
      : url.includes('/info/verified_wave_dataset/')
        ? infoPayload([{ name: 'hs', standardName: 'sea_surface_wave_significant_height', unit: 'm' }])
        : url.includes('/info/verified_current_dataset/')
          ? infoPayload([
            { name: 'u_current', standardName: 'eastward_sea_water_velocity', unit: 'm s-1' },
            { name: 'v_current', standardName: 'northward_sea_water_velocity', unit: 'm s-1' },
          ])
          : url.includes('/griddap/verified_sst_dataset')
            ? {
              table: {
                columnNames: ['time', 'latitude', 'longitude', 'sst'],
                rows: [['2026-09-15T00:00:00Z', 9.93, 76.27, 28.4]],
              },
            }
            : url.includes('/griddap/verified_wave_dataset')
              ? {
                table: {
                  columnNames: ['time', 'latitude', 'longitude', 'hs'],
                  rows: [['2026-09-15T00:00:00Z', 9.93, 76.27, 1.8]],
                },
              }
              : {
                table: {
                  columnNames: ['time', 'latitude', 'longitude', 'u_current', 'v_current'],
                  rows: [['2026-09-15T00:00:00Z', 9.93, 76.27, 3, 4]],
                },
              }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

test('valid coordinates retrieve and normalize verified SST, wave, and current data', async () => {
  const result = await getMarineParameters({
    latitude: 9.9312,
    longitude: 76.2673,
    fetchImpl: successfulFetch,
  })

  assert.equal(result.status, 'ok')
  assert.equal(result.parameters.sst.value, 28.4)
  assert.equal(result.parameters.sst.unit, 'degree_Celsius')
  assert.equal(result.parameters.significantWaveHeight.value, 1.8)
  assert.equal(result.parameters.surfaceCurrent.speed.value, 5)
  assert.ok(Math.abs(result.parameters.surfaceCurrent.direction.value - 36.86989764584405) < 1e-12)
  assert.equal(result.parameters.surfaceCurrent.u, 3)
  assert.equal(result.parameters.surfaceCurrent.v, 4)
  assert.equal(result.parameters.sst.dataset, 'verified_sst_dataset')
  assert.equal(result.parameters.significantWaveHeight.variable, 'hs')
})

test('invalid coordinates are rejected before catalog access', async () => {
  await assert.rejects(
    () => getMarineParameters({
      latitude: 91,
      longitude: 76,
      fetchImpl: successfulFetch,
    }),
    (error) => error instanceof IncoisRequestError &&
      error.code === 'INVALID_COORDINATES'
  )
})

test('catalog unavailability returns structured unavailable status', async () => {
  const unavailableFetch = async () => new Response('', { status: 503 })
  const result = await getMarineParameters({
    latitude: 9.9312,
    longitude: 76.2673,
    fetchImpl: unavailableFetch,
  })

  assert.equal(result.status, 'unavailable')
  assert.deepEqual(result.parameters, {})
  assert.equal(result.error.code, 'INCOIS_HTTP_ERROR')
  assert.equal(result.error.upstreamStatus, 503)
})

test('empty metadata is reported instead of producing a fabricated value', async () => {
  const malformedFetch = async (url) => {
    if (url.includes('/tabledap/allDatasets')) return new Response(
      JSON.stringify(catalog),
      { status: 200 }
    )
    return new Response(JSON.stringify({ table: { columnNames: [], rows: [] } }), {
      status: 200,
    })
  }

  await assert.rejects(
    () => getSST({
      latitude: 9.9312,
      longitude: 76.2673,
      fetchImpl: malformedFetch,
    }),
    (error) => error instanceof IncoisRequestError &&
      error.code === 'INCOIS_EMPTY_METADATA'
  )
})
