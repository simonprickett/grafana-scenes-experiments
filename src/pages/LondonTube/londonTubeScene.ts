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

export function londonTubeScene() {
  const queryRunnerTflAPI = new SceneQueryRunner({
    datasource: {
      type: 'yesoreyeram-infinity-datasource',
      // TODO: This requires an instance of infinity datasource to be created with
      // this name, but should we really need that given all the information is below?
      uid: 'yesoreyeram-infinity-datasource' // TODO rename this in Grafana config.
    },
    queries: [
      {
        refId: 'A',
        url: 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx?stpid=30033&outputType=JSON&key=5bf50badfc9f4bd48c9d694823ddb07b', // TODO how to hide this?
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
    $data: queryRunnerTflAPI,
    controls: [
      new SceneControlsSpacer(),
      new SceneRefreshPicker({
        intervals: ['10s', '15s', '30s', '1m', '5m', '10m', '30m'],
        isOnCanvas: true,
        refresh: '15s',
      }),
    ],
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [
        (() => {
          const platformNumberPanel = PanelBuilders
            .stat()
            .setTitle('')
            .setOption('reduceOptions', {
              calcs: ['firstNotNull'],
              fields: 'None'
            })
            .setOption('textMode', BigValueTextMode.Value)
            .setOption('colorMode', BigValueColorMode.None)
            .setData(queryRunnerTflAPI)
            .build();

          platformNumberPanel.setState({
            ...platformNumberPanel.state,
            fieldConfig: {
              ...platformNumberPanel.state.fieldConfig,
              defaults: {
                ...platformNumberPanel.state.fieldConfig?.defaults,
                noValue: '1'
              }
            }
          });

          return new SceneFlexItem({
            width: '10%',
            height: 300,
            body: platformNumberPanel
          });
        })(),
        (() => {
          const buildArrivalPanel = (value: number | null | undefined) => {
            if (value !== null && value !== undefined && value >= 2) {
              // Let's use a gauge for 2+ minutes.
              const arrivalGaugePanel = PanelBuilders
              .gauge()
              .setTitle('')
              .setOption('reduceOptions', {
                calcs: ['firstNotNull'],
                fields: 'minutes_until_arrival'
              })
              .setData(queryRunnerTflAPI)
              .build();
  
              arrivalGaugePanel.setState({
                ...arrivalGaugePanel.state,
                fieldConfig: {
                  ...arrivalGaugePanel.state.fieldConfig,
                  defaults: {
                    ...arrivalGaugePanel.state.fieldConfig?.defaults,
                    unit: 'min',
                    min: 0,
                    max: 10,
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

              return arrivalGaugePanel;
            } else {
              // Let's use a stat panel.
              const arrivalPanel = PanelBuilders
              .stat()
              .setOption('reduceOptions', {
                calcs: ['firstNotNull'],
                fields: 'minutes_until_arrival'
              })
              .setOption('textMode', BigValueTextMode.Value)
              .setOption('colorMode', BigValueColorMode.BackgroundSolid)
              .setOption('graphMode', BigValueGraphMode.None)
              .setData(queryRunnerTflAPI)
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

              return arrivalPanel;
            }
          };

          // Create the SceneFlexItem with an initial panel
          const arrivalFlexItem = new SceneFlexItem({
            width: '28%',
            height: 300,
            body: buildArrivalPanel(null)
          });

          // Track the current panel type to avoid unnecessary rebuilds
          let currentPanelType: 'gauge' | 'stat' | null = null;

          queryRunnerTflAPI.subscribeToState((state) => {
            const data = state.data;
            if (data?.series && data.series.length > 0) {
              const series = data.series[0];
              const minsToArrival = series.fields.find(f => f.name === 'minutes_until_arrival');
              const value = minsToArrival?.values[0];
              console.log(`ESTIMATED TIME PANEL DATA: ${value} as ${typeof value}`);

              // Determine which panel type we need
              // Stat panel for 0, 1, or unknown; gauge for 2+ minutes
              const needsPanelType = (value !== null && value !== undefined && value >= 2) ? 'gauge' : 'stat';

              // Only swap if the panel type changed
              console.log(`NEEDS PANEL TYPE: ${needsPanelType} as ${typeof needsPanelType}`);
              console.log(`CURRENT PANEL TYPE: ${currentPanelType} as ${typeof currentPanelType}`);
              if (needsPanelType !== currentPanelType) {
                console.log(`SWAPPING PANEL TYPE FROM ${currentPanelType} TO ${needsPanelType}`);
                currentPanelType = needsPanelType;
                arrivalFlexItem.setState({
                  body: buildArrivalPanel(value)
                });
              }
            }
          });

          return arrivalFlexItem;
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

          queryRunnerTflAPI.subscribeToState((state) => {
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
