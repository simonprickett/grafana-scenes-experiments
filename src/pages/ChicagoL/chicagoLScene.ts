import { EmbeddedScene, SceneFlexLayout, SceneFlexItem, PanelBuilders, SceneQueryRunner, SceneRefreshPicker, SceneControlsSpacer } from '@grafana/scenes';
import { BigValueColorMode, BigValueTextMode, ThresholdsMode, MappingType, BigValueGraphMode } from '@grafana/schema';


// TODO: Have a constant for first departure row height and use it.
// TODO: Can we get rid of the stat panel empty title spaces?
// TODO: Add the On Time / Delayed panel
// TODO: Look at whether we can add a function that generates a "static text stat panel"
// TODO: first departure row layout
// TODO: design a 2nd departure row
// TODO: implement this as rows 2..4
// TODO: secrets management in scenes

export function chicagoLScene() {
  const queryRunnerChicago = new SceneQueryRunner({
    datasource: {
      type: 'yesoreyeram-infinity-datasource',
      // TODO: This requires an instance of infinity datasource to be created with
      // this name, but should we really need that given all the information is below?
      uid: 'carbon-intensity-data-source' // TODO rename this in Grafana config.
    },
    queries: [
      {
        refId: 'A',
        url: 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx?mapid=40680&outputType=JSON&key=5bf50badfc9f4bd48c9d694823ddb07b', // TODO how to hide this?
        method: 'GET',
        source: 'url',
        parser: 'jq-backend',
        root_selector: `
          . as $root | [.ctatt.eta[] | . as $v | {        
            arrival_time: $v.arrT,        
                minutes_until_arrival: (
                (
                  (
                    ($v.arrT | sub("T"; " ") | strptime("%Y-%m-%d %H:%M:%S") | mktime)
                    -
                    ($root.ctatt.tmst | sub("T"; " ") | strptime("%Y-%m-%d %H:%M:%S") | mktime)
                  ) / 60
                  | floor
                )
                | if . < 0 then 0 else . end
              ),    
            destination: $v.destNm,        
            station: $v.staNm,      
            latitude: $v.lat,      
            longitude: $v.lon,      
            run_number: $v.rn,
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
            line_color_code: (
              if $v.rt == "Org" then "rgb(249, 70, 28)"
              elif $v.rt == "Pink" or $v.rt == "Pnk" or $v.rt == "P" then "rgb(226, 126, 166)"
              elif $v.rt == "G" or $v.rt == "Grn" then "rgb(0, 169, 79)"
              elif $v.rt == "Red" then "rgb(200, 16, 46)"
              elif $v.rt == "Blue" or $v.rt == "Blu" then "rgb(0, 161, 222)"
              elif $v.rt == "Brn" then "rgb(118, 66, 0)"
              elif $v.rt == "Y" or $v.rt == "Ylw" then "rgb(249, 227, 0)"
              elif $v.rt == "Pexp" or $v.rt == "Purp" then "rgb(82, 35, 152)"
              else "rgb(128, 128, 128)"
              end
            ),
            is_approaching: ($v.isApp == "1"),        
            is_delayed: ($v.isDly == "1"),        
            platform: (($v.stpDe // "Unknown") | sub("^Service at "; "") | sub(" platform$"; ""))         
          } ] | sort_by(.arrival_time) | to_entries | .[] | .value + {row_number: (.key + 1)}   
        `
      },
    ],
  });

  return new EmbeddedScene({
    $data: queryRunnerChicago,
    controls: [
      new SceneControlsSpacer(),
      new SceneRefreshPicker({
        intervals: ['30s', '1m', '5m', '10m', '30m'],
        isOnCanvas: true,
        refresh: '1m',
      }),
    ],
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [
        (() => {
          const platformPanel = PanelBuilders
            .stat()
            .setTitle('')
            .setOption('reduceOptions', {
              calcs: ['firstNotNull'],
              fields: 'None'
            })
            .setOption('textMode', BigValueTextMode.Value)
            .setOption('colorMode', BigValueColorMode.None)
            .setData(queryRunnerChicago)
            .build();

          platformPanel.setState({
            ...platformPanel.state,
            fieldConfig: {
              ...platformPanel.state.fieldConfig,
              defaults: {
                ...platformPanel.state.fieldConfig?.defaults,
                noValue: 'Adams/Wabash (Outer Loop)'
              }
            }
          });

          return new SceneFlexItem({
            width: '100%',
            height: 120,
            body: platformPanel
          });
        })(),
        (() => {
          const departureNumberPanel = PanelBuilders
            .stat()
            .setTitle('')
            .setOption('reduceOptions', {
              calcs: ['firstNotNull'],
              fields: 'None'
            })
            .setOption('textMode', BigValueTextMode.Value)
            .setOption('colorMode', BigValueColorMode.None)
            .setData(queryRunnerChicago)
            .build();

          departureNumberPanel.setState({
            ...departureNumberPanel.state,
            fieldConfig: {
              ...departureNumberPanel.state.fieldConfig,
              defaults: {
                ...departureNumberPanel.state.fieldConfig?.defaults,
                noValue: '1'
              }
            }
          });

          return new SceneFlexItem({
            width: '10%',
            height: 300,
            body: departureNumberPanel
          });
        })(),
        (() => {
          const arrivalPanel = PanelBuilders
            .stat()
            .setOption('reduceOptions', {
              calcs: ['firstNotNull'],
              fields: 'minutes_until_arrival'
            })
            .setOption('textMode', BigValueTextMode.Value)
            .setOption('colorMode', BigValueColorMode.BackgroundSolid)
            .setOption('graphMode', BigValueGraphMode.None)
            .setData(queryRunnerChicago)
            .build();

          // Set up thresholds and unit
          arrivalPanel.setState({
            ...arrivalPanel.state,
            fieldConfig: {
              ...arrivalPanel.state.fieldConfig,
              defaults: {
                ...arrivalPanel.state.fieldConfig?.defaults,
                unit: 'min',
                mappings: [
                  {
                    type: MappingType.ValueToText,
                    options: {
                      '0': {
                        text: 'Approaching'
                      }
                    }
                  }
                ],
                thresholds: {
                  mode: ThresholdsMode.Absolute,
                  steps: [
                    { color: 'red', value: 0 },
                    { color: 'orange', value: 1 }, 
                    { color: 'yellow', value: 2 },
                    { color: 'green', value: 3 }
                  ]
                }
              }
            }
          });

          queryRunnerChicago.subscribeToState((state) => {
            const data = state.data;
            if (data?.series && data.series.length > 0) {
              const series = data.series[0];
              const minsToArrival = series.fields.find(f => f.name === 'minutes_until_arrival');
              console.log(`ESTIMATED TIME PANEL DATA: ${minsToArrival?.values[0]}`);
            }
          });

          return new SceneFlexItem({
            width: '28%',
            height: 300,
            body: arrivalPanel
          });
        })(),
        
        (() => {
          const firstDestinationPanel = PanelBuilders
            .stat()
            .setTitle('')
            .setOption('reduceOptions', {
              calcs: ['firstNotNull'],
              fields: 'destination'
            })
            .setOption('textMode', BigValueTextMode.Value)
            .setOption('colorMode', BigValueColorMode.BackgroundSolid)
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

                firstDestinationPanel.setState({
                  ...firstDestinationPanel.state,
                  fieldConfig: {
                    ...firstDestinationPanel.state.fieldConfig,
                    defaults: {
                      ...firstDestinationPanel.state.fieldConfig?.defaults,
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
            width: '50%',
            height: 300,
            body: firstDestinationPanel
          });
        })(),
      ],
    }),
  });
}
