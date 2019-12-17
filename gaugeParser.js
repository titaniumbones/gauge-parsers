/* 

   RIVER GAUGE DEFINITIONS

*/
const streetsville = {
  "name": "Credit River at Streetsville",
  "slug": "lowercredit",
  "gaugeType": "wateroffice",
  "gaugeID": "02HB029",
  "units": "cms",
  "lat":123.456,
  "long": -456.789,
  "levels": [[0,4.6,"bad"], [4.6,8,"shoulder"], [8,50,"good"],[50,100,"shoulder"]],
  "qualityPeaks": [ [0,"bad"], [85, "good"], [170, "bad"], [290, "bad"] ],
  "minHeight": 4.6
},
      // irvine =   {
      //   "name": "Irvine",
      //   "gaugeType": "wateroffice",
      //   "gaugeID": "02GA005",
      //   "slug": "irvine",
      //   "units": "cms",
      //   "points":{ 
      //     "putin": [43.702321,-80.445578] ,
      //     "takeout": [43.662701, -80.453265] 
      //   },
      //   "levels": [[0,4.6,"bad"], [4.6,8,"shoulder"], [8,50,"good"],[50,100,"shoulder"]],
      //   "qualityPeaks": [ [0,"bad"], [85, "good"], [170, "bad"], [290, "bad"] ],
      //   "minHeight": 4.6
      // },
      irvine =   {
        "name": "Irvine",
        "gaugeType": "grca",
        "gaugeID": "Irvine R. Salem",
        "slug": "irvine",
        "units": "cms",
        "points":{ 
          "putin": [43.702321,-80.445578] ,
          "takeout": [43.662701, -80.453265] 
        },
        "levels": [[0,4.6,"bad"], [4.6,8,"shoulder"], [8,50,"good"],[50,100,"shoulder"]],
        "qualityPeaks": [ [0,"bad"], [85, "good"], [170, "bad"], [290, "bad"] ],
        "minHeight": 4.6
      },

      elora = {
        name: "Elora Gorge at Shand Dam",
        gaugeType: "grca",
        gaugeID: 'Shand Dam Discharge',
        "units": "cms",
        slug: "grand",
        points: {
          putin: [43.4379897,-80.2842689],
          takeout:[43.662701, -80.453265]
        },
        minHeight: 5,
        levels: [[0,4.6,"bad"], [4.6,8,"shoulder"], [8,50,"good"],[50,100,"shoulder"]],
      },
      upperCredit = {
        name: "Upper Credit River at Belfountain",
        gaugeType: "cvc",
        gaugeID: '14522010',
        "units": "cms",
        slug: "uppercredit",
        points: {},
        minHeight: 0.75,
        levels: [[0,0.75,"bad"], [0.75, 0.78,"shoulder"], [0.78, 1.1,"good"],[1.1,100,"shoulder"]],
      },
      rivers =[elora, streetsville, upperCredit, irvine];


const cors = `https://hackinghistory.ca:9090/`; // `https://cors-anywhere.herokuapp.com/`


/* DICTIONARY mapping gauge type to function */

// I think fn symbols are hoisted so should be ok here?
const gaugeDict = {
  cvc: processWiskiData,
  grca: processWiskiData,
  wateroffice: processWOData
}

// stupid to have this in two places but I need it in this form for the service worker
// in the other repo, which will return fetched data in a `postMessage` 
const dataProcDict = {
  cvc: false
}

/* TESTER for all gauge types */

function testGood (level, spotMeta=streetsville) {
  let value = 'bad';
  spotMeta.levels
    .some( function (d)  {
      if ( (d[0] < level) && ( level < d[1])  ) {
        // console.log(d);
        value = d[2]; return; }
    });
  //console.log(value)
  return value
}


/*
 *
 * WISKI/KIWIS-based gauges (currently grca & cvc)
 * see notes for individual discrapncies
 * 
 */


// for parsing grand river json data,
// see ~line 65 of https://apps.grandriver.ca/waterdata/kiwischarts/js/RF_Charts.js?v1.0
// accessed 2019-12-04
// also cf variable definitions in https://apps.grandriver.ca/waterdata/kiwischarts/rf_uppergrand.aspx
// doesn't appear to accept a date parameter -- suggests that historical data is available elsewhere
async function getGrandJSON (stationData, needCors=true) {
  let id = stationData.gaugeID,
      url = `https://apps.grandriver.ca/waterdata/kiwischarts/wiskiData/RF_Charts_UpperGrand/${id}.json`,
      headers={'Spot-ID': stationData.slug};
  if (needCors) {url = `${cors}${url}`;}

  return await fetch(url, {headers: headers})
  .then ( async (res) => {
      console.log(res.headers.get('Content-Type'))
      return res.json()
    })
  .then ( (json) => { console.log(json);
                      return json[0].data} )
  .catch(function(error){console.log(error);});
}


async function getcvcJSON (stationData, needCors=true) {
  console.log("GETCVC info", stationData)
  let id = stationData.gaugeID,
      baseUrl = 'https://waterinfo.cvc.ca/KiWIS/KiWIS?service=kisters&type=queryServices&request=getTimeseriesValues&datasource=0&format=dajson&',
      start = moment().subtract(4, 'days').format('YYYY-MM-DD'),
      end = moment().format('YYYY-MM-DD'),
      url = `${baseUrl}&ts_id=${id}&from=${start}&to=${end}&dateformat=UNIX`;
      headers={'ATTEMPT': 'uppercredit'};
  // if (needCors) {url = `${cors}${url}`;}
 // console.log(url)
  return await fetch(url , {referrer: `${location.href}#${stationData.slug}:${stationData.gaugetype}`}
                    )
  .then ( async (res) => {
    // console.log('RES', res)
     // res.clone().json().then( (t) => console.log(t))
      // console.log(res.headers.get('Content-Type'))
      return res.json()
    })
  .then ( (json) => { console.log('JSON', json);
                      return json[0].data} )
    .catch(function(error){console.log(error);});
}

async function processWiskiData (spot) {
  // this might stop working if we get other similar data sources, may need to
  // refactor!
  const getter = spot.gaugeType === 'grca' ? getGrandJSON : getcvcJSON,
        raw = await getter(spot);
  // console.log ("MAP")
  return m = raw.map( (item) => {
    let meta = {};
    meta.height = Number(item[1]);
    meta.quality = testGood(item[1], spot);
    meta.units = spot.units;
    meta.data = item;
    // note: may need to adjust date for DST & time zone -- cf.
    // functions & comments in https://apps.grandriver.ca/waterdata/kiwischarts/js/RF_Charts.js?v1.0
    // lines ~43-65
    const itemObj = {x: new Date(item[0]),
                     y: item[1],
                     meta: meta
                    }
    return itemObj })
}



// let proxy = 'https://cors-anywhere.herokuapp.com/';
async function getWOJSON (stationData, needCors = true) {
  let start = moment().subtract(4, 'days').format('YYYY-MM-DD'),
      end = moment().format('YYYY-MM-DD'),
      headers = {'Origin': "localhost", 'X-Spot-ID': stationData.slug}
  params = `?param1=47&start_date=${start}&end_date=${end}&station=${stationData["gaugeID"]}`;
    let url = `https://wateroffice.ec.gc.ca/services/real_time_graph/json/inline${params}`;
  if (needCors) {url = `${cors}${url}`;}
  // console.log(url);
  // let target = `${url}${params}`;
  return await fetch(url, {headers: headers})
    .then ( async (res) => {
      // console.log(res.headers.get('Content-Type'))
      return res.json()
    })
  .then ( (json) => { // console.log(json);
                      return json["47"].provisional} )
    .catch(function(error){console.log(error);});
}



async function processWOData (spot=streetsville) {
  const raw = await getWOJSON(spot);
  return raw.map((item) => {
    let meta = {};
    meta.height = Number(item[1]);
    meta.quality = testGood(item[1], spot);
    meta.units = spot.units;
    meta.data = item;
    const itemObj =  { x: new Date(item[0]),
                       y: item[1],
                       meta: meta
                     };
    // console.log(itemObj);
    return itemObj
  })
}

async function processGauge (spot=irvine, mapper=gaugeDict) {
  // console.log(spot.gaugeType, mapper[spot.gaugeType]);
  return await mapper[spot.gaugeType](spot);
}
