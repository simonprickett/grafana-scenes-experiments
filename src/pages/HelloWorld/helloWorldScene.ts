import { EmbeddedScene, SceneDataTransformer, SceneFlexLayout, SceneFlexItem, SceneQueryRunner, PanelBuilders, /*SceneGridRow*/ } from '@grafana/scenes';
import { MappingType, BigValueColorMode, BigValueTextMode, ThresholdsMode, VizOrientation, BarGaugeDisplayMode, BarGaugeValueMode } from '@grafana/schema';

export function helloWorldScene() {
  const queryRunner1 = new SceneQueryRunner({
    datasource: {
      type: 'yesoreyeram-infinity-datasource',
      // TODO: This requires an instance of infinity datasource to be created with
      // this name, but should we really need that given all the information is below?
      uid: 'carbon-intensity-data-source'
    },
    queries: [
      {
        refId: 'A',
        url: 'https://api.carbonintensity.org.uk/regional',
        method: 'GET',
        source: 'url',
        parser: 'jq-backend',
        root_selector: `
          .data[0].regions[] | {
            regionid: .regionid,
            shortname: .shortname,
            forecast: .intensity.forecast,
            index: .intensity.index,
            gas: (.generationmix[] | select(.fuel == "gas") | .perc),
            wind: (.generationmix[] | select(.fuel == "wind") | .perc),
            nuclear: (.generationmix[] | select(.fuel == "nuclear") | .perc),
            solar: (.generationmix[] | select(.fuel == "solar") | .perc),
            hydro: (.generationmix[] | select(.fuel == "hydro") | .perc),
            biomass: (.generationmix[] | select(.fuel == "biomass") | .perc),
            imports: (.generationmix[] | select(.fuel == "imports") | .perc),
            other: (.generationmix[] | select(.fuel == "other") | .perc),
            renewables: [ (.generationmix[] | select(.fuel == "biomass") | .perc), (.generationmix[] | select(.fuel == "wind") | .perc), (.generationmix[] | select(.fuel == "solar") | .perc), (.generationmix[] | select(.fuel == "hydro") | .perc) ] | add
          }`
      },
    ],
  });

  const queryRunner2 = new SceneQueryRunner({
    // TODO this should be able to just be a 2nd query on the previous runner that
    // uses the same URL and datasource?
    datasource: {
      type: 'yesoreyeram-infinity-datasource',
      // TODO: This requires an instance of infinity datasource to be created with
      // this name, but should we really need that given all the information is below?
      uid: 'carbon-intensity-data-source'
    },
    queries: [
      {
        refId: 'A',
        url: 'https://api.carbonintensity.org.uk/regional',
        method: 'GET',
        source: 'url',
        parser: 'jq-backend',
        root_selector: `
          .data[0] | {
            timePeriod: (
              (.from | strptime("%Y-%m-%dT%H:%MZ") | strftime("%A %B %d %Y %H:%M"))
              + "-" +
              (.to   | strptime("%Y-%m-%dT%H:%MZ") | strftime("%H:%M") + " UTC") 
            )
          }
        `
      },
    ],
  });

  // This should come from the data really...
  const regions = [
    'North Scotland',
    'South Scotland',
    'North West England',
    'North East England',
    'Yorkshire',
    'South East England',
    'North Wales & Merseyside',
    'South Wales',
    'West Midlands',
    'East Midlands',
    'East England',
    'South West England',
  ];

  const countries = [
    'GB',
    'England',
    'Scotland',
    'Wales',
  ];

  const countryStats: SceneFlexItem[] = countries.flatMap((countryName) => {
    const transformer = new SceneDataTransformer({
      $data: queryRunner1,
      transformations: [
        {
          id: 'filterByValue',
          options: {
            filters: [
              {
                config: {
                  id: 'equal',
                  options: {
                    value: countryName
                  }
                },
                fieldName: 'shortname'
              }
            ],
            match: 'any',
            type: 'include'
          }
        }
      ]
    });

    return [ 
      new SceneFlexItem({
        width: '24%',
        height: 200,
        body: 
          PanelBuilders
            .stat()
            .setTitle(countryName)
            // TODO: Why can't the text be white for these?  It is on the reference dashboard.
            // TODO: colors should be the same for both stats at all times, green wanders sometimes?
            .setMappings([
            {
              options: {
                high: {
                  color: 'orange',
                },
                low: {
                  color: 'green',
                },
                moderate: {
                  color: 'yellow',
                },
                'very high': {
                  color: 'red',
                },
                'very low': {
                  color: 'green',
                }
              },
              type: MappingType.ValueToText
            }])
            .setThresholds({
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  color: 'green',
                  value: 0,
                },
                {
                  color: 'light-green', 
                  value: 30,
                },
                {
                  color: 'yellow',
                  value: 120,
                },
                {
                  color: 'orange',
                  value: 150,
                },
                {
                  color: 'red',
                  value: 200,
                },
              ],
            })
            .setOption('reduceOptions', {
              calcs: [
                'lastNotNull'
              ],
              fields: 'index|forecast'                   
            })
            .setOption('colorMode', BigValueColorMode.BackgroundSolid)
            .setOption('textMode', BigValueTextMode.Value)
            .setData(transformer)
            .build(),
      }),
    ]
  });

  const countryGauges: SceneFlexItem[] = countries.flatMap((countryName) => {
    // TODO can we factor this out and re-use the one from above?
    const transformer = new SceneDataTransformer({
      $data: queryRunner1,
      transformations: [
        {
          id: 'filterByValue',
          options: {
            filters: [
              {
                config: {
                  id: 'equal',
                  options: {
                    value: countryName
                  }
                },
                fieldName: 'shortname'
              }
            ],
            match: 'any',
            type: 'include'
          }
        }
      ]
    });

    return [ 
      new SceneFlexItem({
        width: '24%',
        height: 200,
        body: 
          PanelBuilders.gauge()
            .setTitle('Renewables')
            .setOption('reduceOptions', {
              calcs: [
                'lastNotNull'
              ],
              fields: 'renewables'                   
            })
            .setThresholds({
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  color: 'red',
                  value: 0,
                },
                {
                  color: 'orange', 
                  value: 30,
                },
                {
                  color: 'yellow',
                  value: 40,
                },
                {
                  color: 'green',
                  value: 60,
                },
              ],
            })
            .setUnit('percent')
            .setData(transformer)
            .build()
      })
    ]
  });

  return new EmbeddedScene({
    $data: queryRunner1,
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [
        new SceneFlexItem({
          width: '100%',
          height: 80,
          body: PanelBuilders
            .text()
            .setTitle('')
            .setOption('content', 
              `<p>A visualization of the UK's carbon intensity and electricity generation mix. This uses the <a href="https://carbonintensity.org.uk/">Carbon Intensity JSON API</a> 
               and the <a href="https://grafana.com/grafana/plugins/yesoreyeram-infinity-datasource/">Grafana Infinity Data Source</a> with its JQ parser.</p>`
            )
            .build(),
        }),
        new SceneFlexItem({
          $data: queryRunner2,
          width: '100%',
          height: 80,
          body: PanelBuilders
            .stat()
            .setTitle('')
            .setOption('reduceOptions', {
              fields: 'timePeriod'                   
            })
            .setOption('textMode', BigValueTextMode.Value)
            .setOption('colorMode', BigValueColorMode.None)
            .build()
        }),
        ...countryStats,
        ...countryGauges,
        new SceneFlexItem({
          width: '48.5%',
          height: 400,
          $data: new SceneDataTransformer({
            $data: queryRunner1,
            transformations: [
              {
                id: 'filterFieldsByName',
                options: {
                  include: {
                    names: [
                      'shortname',
                      'forecast'
                    ]
                  }
                }
              },
              {
                id: 'sortBy',
                options: {
                  fields: {},
                  sort: [
                    {
                      desc: true,
                      field: 'forecast'
                    }
                  ]
                }
              }
            ]
          }),
          body: PanelBuilders
            .bargauge()
            .setTitle('Carbon Intensity by Region')
            .setOption('orientation', VizOrientation.Horizontal)
            .setOption('displayMode', BarGaugeDisplayMode.Lcd)
            .setOption('valueMode', BarGaugeValueMode.Hidden)
            .setOption('showUnfilled', true)
            .setOption('reduceOptions', {
              calcs: [],
              fields: '',
              values: true
            })
            .setColor({ mode: 'continuous-GrYlRd' })
            .setThresholds({
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  color: 'red',
                  value: 0
                }
              ]
            })
            .build()
        }),
        new SceneFlexItem({
          width: '48.5%',
          height: 400,
          $data: new SceneDataTransformer({
            $data: queryRunner1,
            transformations: [
              {
                id: 'filterFieldsByName',
                options: {
                  include: {
                    names: [
                      'shortname',
                      'renewables'
                    ]
                  }
                }
              },
              {
                id: 'sortBy',
                options: {
                  fields: {},
                  sort: [
                    {
                      desc: true,
                      field: 'renewables'
                    }
                  ]
                }
              }
            ]
          }),
          body: PanelBuilders
            .bargauge()
            .setTitle('Renewables by Region')
            .setOption('orientation', VizOrientation.Horizontal)
            .setOption('displayMode', BarGaugeDisplayMode.Lcd)
            .setOption('valueMode', BarGaugeValueMode.Hidden)
            .setOption('showUnfilled', true)
            .setOption('reduceOptions', {
              calcs: [],
              fields: '',
              values: true
            })
            .setColor({ mode: 'continuous-GrYlRd' })
            .setThresholds({
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  color: 'red',
                  value: 0
                }
              ]
            })
            .build()
        }),
        // TODO now we want the following per region:
        // - A stat panel with the carbon intensity number and forecast.
        // - A bar gauge, LCD style all greens for the renewables info.
        // - A regular gauge for renewables.
        // - A regular gauge for fossil fuels.
        // TODO this can be removed long term., for now it is useful for debugging data..
        new SceneFlexItem({
          width: '100%',
          height: 600,
          body: PanelBuilders.table().setTitle('Data').setData(queryRunner1).build(),
        })
      ],
    }),
  });
}
