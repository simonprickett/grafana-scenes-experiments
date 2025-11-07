import { EmbeddedScene, SceneDataTransformer, SceneFlexLayout, SceneFlexItem, SceneQueryRunner, PanelBuilders } from '@grafana/scenes';
import { MappingType, BigValueColorMode, BigValueTextMode, ThresholdsMode, VizOrientation, BarGaugeDisplayMode, BarGaugeValueMode, BarGaugeNamePlacement } from '@grafana/schema';

// TODO: Forecast colors for intensity index are a bit out.  100 is considered moderate.
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

  const queryRunnerChicago = new SceneQueryRunner({
    datasource: {
      type: 'yesoreyeram-infinity-datasource',
      // TODO: This requires an instance of infinity datasource to be created with
      // this name, but should we really need that given all the information is below?
      uid: 'carbon-intensity-data-source'
    },
    queries: [
      {
        refId: 'A',
        url: 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx?mapid=40680&outputType=JSON&key=5bf50badfc9f4bd48c9d694823ddb07b', // TODO how to hide this?
        method: 'GET',
        source: 'url',
        parser: 'jq-backend',
        root_selector: `
          [.ctatt.eta[] | . as $v | {        
            arrival_time: $v.arrT,        
            minutes_until_arrival: (((($v.arrT | sub("T"; " ") | strptime("%Y-%m-%d %H:%M:%S") | mktime) - now) / 60 | floor) + 300),      
            destination: $v.destNm,        
            station: $v.staNm,      
            latitude: $v.lat,      
            longitude: $v.lon,      
            line_color: (        
              if $v.rt == "Org" then "Orange"        
              elif $v.rt == "Pink" or $v.rt == "Pnk" or $v.rt == "P" then "Pink"        
              elif $v.rt == "G" or $v.rt == "Grn" then "Green"        
              elif $v.rt == "Red" then "Red"        
              elif $v.rt == "Blue" or $v.rt == "Blu" then "Blue"        
              elif $v.rt == "Brn" then "Brown"        
              elif $v.rt == "Y" or $v.rt == "Ylw" then "Yellow"        
              elif $v.rt == "Pexp" or $v.rt == "Purp" then "Purple"        
              else $v.rt        
              end        
            ),        
            is_approaching: ($v.isApp == "1"),        
            is_delayed: ($v.isDly == "1"),        
            platform: (($v.stpDe // "Unknown") | sub("^Service at "; "") | sub(" platform$"; ""))         
          } | select(.platform == "Outer Loop")] | sort_by(.arrival_time) | to_entries | .[] | .value + {row_number: (.key + 1)}  
        `
      },
    ],
  });

  // This should come from the data really...
  // Define regions so each can have a row of panels.
  const regions = [
    'North Scotland',
    'South Scotland', 
    'North West England',
    'North East England',
    'Yorkshire',
    'North Wales & Merseyside',
    'South Wales',
    'West Midlands',
    'East Midlands',
    'East England',
    'London',
    'South West England',
    'South England',
    'South East England',
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
            .setMappings([
            {
              options: {
                high: {
                  color: 'orange',
                  index: 3
                },
                low: {
                  color: 'green',
                  index: 1
                },
                moderate: {
                  color: 'yellow',
                  index: 2
                },
                'very high': {
                  color: 'red',
                  index: 4
                },
                'very low': {
                  color: 'dark-green',
                  index: 0
                }
              },
              type: MappingType.ValueToText
            }])
            .setThresholds({
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  color: 'dark-green',
                  value: 0,
                },
                {
                  color: 'green', 
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

  const regionSpecifics: SceneFlexItem[] = regions.flatMap((regionName) => {
    // TODO can we sort this out?
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
                    value: regionName
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
      // TODO now we want the following per region:
      // - Some way of showing the region name.
      // - A stat panel with the carbon intensity number and forecast.
      // - A bar gauge, LCD style all greens for the renewables info.
      // - A regular gauge for renewables.
      // - A regular gauge for fossil fuels.
      new SceneFlexItem({
        width: '100%',
        height: 300,
        body: new SceneFlexLayout({
          direction: 'row',
          children: [
          new SceneFlexItem({
            width: '24%',
            /*height: 200,*/
            body: 
              PanelBuilders
                .stat()
                .setTitle(regionName)
                .setMappings([
                {
                  options: {
                    high: {
                      color: 'orange',
                      index: 3
                    },
                    low: {
                      color: 'green',
                      index: 1
                    },
                    moderate: {
                      color: 'yellow',
                      index: 2
                    },
                    'very high': {
                      color: 'red',
                      index: 4
                    },
                    'very low': {
                      color: 'dark-green',
                      index: 0
                    }
                  },
                  type: MappingType.ValueToText
                }])
                .setThresholds({
                  mode: ThresholdsMode.Absolute,
                  steps: [
                    {
                      color: 'dark-green',
                      value: 0,
                    },
                    {
                      color: 'green', 
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
                .setColor({ mode: 'thresholds' })
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
          // Electricity sources bar gauge.
          // TODO this needs to be sorted.
          // TODO this may also have redundant transforms.
          new SceneFlexItem({
            width: '24%',
            height: 300,
            $data: new SceneDataTransformer({
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
                            value: regionName
                          }
                        },
                        fieldName: 'shortname'
                      }
                    ],
                    match: 'any',
                    type: 'include'
                  }
                },
                {
                  id: 'filterFieldsByName',
                  options: {
                    include: {
                      names: [
                        'biomass',
                        'gas',
                        'hydro',
                        'imports',
                        'nuclear',
                        'other',
                        'solar',
                        'wind'
                      ]
                    }
                  }
                },
                {
                  id: 'transpose',
                  options: {
                    firstFieldName: 'Fuel'
                  }
                },
                {
                  id: 'sortBy',
                  options: {
                    fields: {},
                    sort: [
                      {
                        desc: true,
                        field: regionName
                      }
                    ]
                  }
                },
                {
                  id: 'transpose',
                  options: {}
                }
              ]
            }),
            body: PanelBuilders
              .bargauge()
              .setOption('orientation', VizOrientation.Horizontal)
              .setOption('displayMode', BarGaugeDisplayMode.Lcd)
              .setOption('valueMode', BarGaugeValueMode.Hidden)
              .setOption('namePlacement', BarGaugeNamePlacement.Top)
              .setOption('showUnfilled', true)
              .setOption('reduceOptions', {
                calcs: ['lastNotNull'],
                fields: '',
                values: false
              })
              .setColor({ mode: 'fixed', fixedColor: 'green' })
              .setUnit('percent')
              .build()
          }),

          // Renweables...
          new SceneFlexItem({
            width: '24%',
            height: 300,
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
          }),

          // Fossil Fuels
          new SceneFlexItem({
            width: '24%',
            height: 300,
            body: 
              PanelBuilders.gauge()
                .setTitle('Fossil Fuels')
                .setOption('reduceOptions', {
                  calcs: [
                    'lastNotNull'
                  ],
                  fields: 'gas'                   
                })
                .setThresholds({
                  mode: ThresholdsMode.Absolute,
                  steps: [
                    {
                      color: 'green',
                      value: 0,
                    },
                    {
                      color: 'yellow', 
                      value: 30,
                    },
                    {
                      color: 'orange',
                      value: 40,
                    },
                    {
                      color: 'red',
                      value: 60,
                    },
                  ],
                })
                .setUnit('percent')
                .setData(transformer)
                .build()
          }),

          ]
        })
      }),
    ]
  });

  return new EmbeddedScene({
    $data: queryRunner1,
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [
        (() => {
          const statPanel = PanelBuilders
            .stat()
            .setTitle('Chicago L Test Panel')
            .setOption('reduceOptions', {
              calcs: ['firstNotNull'],
              fields: 'destination'
            })
            .setOption('textMode', BigValueTextMode.Value)
            .setOption('colorMode', BigValueColorMode.BackgroundSolid)
            .setData(queryRunnerChicago) 
            .build();

          const getLineColorRGB = (lineColor: string): string => {
            const colorMap: Record<string, string> = {
              Brown: 'rgb(118, 66, 0)',
              Green: 'rgb(0, 169, 79)',
              Red: 'rgb(200, 16, 46)',
              Blue: 'rgb(0, 161, 222)',
              Orange: 'rgb(249, 70, 28)',
              Pink: 'rgb(226, 126, 166)',
              Yellow: 'rgb(249, 227, 0)',
              Purple: 'rgb(82, 35, 152)'
            };
            
            return colorMap[lineColor] || 'rgb(128, 128, 128)'; // Default gray for unknown colors
          };

          queryRunnerChicago.subscribeToState((state) => {
            const data = state.data;
            if (data?.series && data.series.length > 0) {
              const series = data.series[0];
              const lineColorField = series.fields.find(f => f.name === 'line_color');

              if (lineColorField && lineColorField.values.length > 0) {
                const lineColorValue = lineColorField.values[0];

                statPanel.setState({
                  ...statPanel.state,
                  fieldConfig: {
                    ...statPanel.state.fieldConfig,
                    defaults: {
                      ...statPanel.state.fieldConfig?.defaults,
                        thresholds: {
                        mode: ThresholdsMode.Absolute,
                        steps: [
                          { color: getLineColorRGB(lineColorValue), value: 0 }
                        ]
                      }
                    }
                  }
                });
              }
            }
          });

          return new SceneFlexItem({
            width: '100%',
            height: 300,
            body: statPanel
          });
        })(),
        // Dynamic stat panel with data-driven modifications
        (() => {
          const statPanel = PanelBuilders
            .stat()
            .setTitle('Dynamic Index Panel')
            .setOption('reduceOptions', {
              calcs: ['firstNotNull'],
              fields: 'index'
            })
            .setOption('textMode', BigValueTextMode.Value)
            .build();

          // Subscribe to queryRunner1 data changes to modify panel properties
          queryRunner1.subscribeToState((state) => {
            const data = state.data;
            if (data?.series && data.series.length > 0) {
              const series = data.series[0];
              console.log(data.series);
              const indexField = series.fields.find(f => f.name === 'solar');
              
              if (indexField && indexField.values.length > 0) {
                const firstIndexValue = indexField.values.get(0); // TODO use .at?
                console.log('First index value:', firstIndexValue);
                
                
                // Modify panel properties based on the data
                if (firstIndexValue < 50) {
                  // High carbon intensity - make it red and add alert styling
                  statPanel.setState({
                    ...statPanel.state,
                    options: {
                      ...statPanel.state.options,
                      colorMode: BigValueColorMode.BackgroundSolid,
                      textMode: BigValueTextMode.Value
                    },
                    fieldConfig: {
                      ...statPanel.state.fieldConfig,
                      defaults: {
                        ...statPanel.state.fieldConfig?.defaults,
                        thresholds: {
                          mode: ThresholdsMode.Absolute,
                          steps: [
                            { color: 'red', value: 0 }
                          ]
                        }
                      }
                    }
                  });
                } else if (firstIndexValue >= 50) {
                  // Low carbon intensity - make it green
                  statPanel.setState({
                    ...statPanel.state,
                    options: {
                      ...statPanel.state.options,
                      colorMode: BigValueColorMode.BackgroundSolid,
                      textMode: BigValueTextMode.Value
                    },
                    fieldConfig: {
                      ...statPanel.state.fieldConfig,
                      defaults: {
                        ...statPanel.state.fieldConfig?.defaults,
                        thresholds: {
                          mode: ThresholdsMode.Absolute,
                          steps: [
                            { color: 'green', value: 0 }
                          ]
                        }
                      }
                    }
                  });
                }
              }
            }
          });

          return new SceneFlexItem({
            width: '100%',
            height: 120,
            body: statPanel
          });
        })(),
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
        ...countryStats, // TODO should these go in their own layout?
        ...countryGauges, // TODO should these go in their own layout?
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
        ...regionSpecifics,        
        // TODO this can be removed long term., for now it is useful for debugging data..
        new SceneFlexItem({
          width: '100%',
          height: 600,
          body: PanelBuilders
            .table()
            .setTitle('Raw Data')
            .setData(queryRunner1)
            .build(),
        })
      ],
    }),
  });
}
