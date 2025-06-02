import { EmbeddedScene, SceneDataTransformer, SceneFlexLayout, SceneFlexItem, SceneQueryRunner, PanelBuilders } from '@grafana/scenes';
import { PieChartType } from '@grafana/schema/dist/esm/raw/composable/piechart/panelcfg/x/PieChartPanelCfg_types.gen';

export function helloWorldScene() {
  const queryRunner1 = new SceneQueryRunner({
    datasource: {
      type: 'yesoreyeram-infinity-datasource',
      uid: 'carbon-intensity-data-source'
    },
    queries: [
      {
        refId: 'A',
        url: 'https://api.carbonintensity.org.uk/regional',
        method: 'GET',
        source: 'url',
        parser: 'uql',
        uql: `
          parse-json|scope "data[0].regions"
          | project "regionid", "shortname", "generationmix", "intensity"
          | mv-expand "fuel_data"="generationmix"
          | extend "intensity"="intensity.index", "fuel"="fuel_data.fuel", "percentage"="fuel_data.perc"
          | project-away "fuel_data"
          | order by "regionid" asc
        `,
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

  const regionPanels: Array<SceneFlexItem> = regions.map((regionName) => 
      (new SceneFlexItem({
      width: '20%',
      height: 150,
      body: 
        PanelBuilders
          .stat()
          .setTitle(regionName)
          // TODO configure the colour values?
          .setOption('reduceOptions', {
            calcs: [
              'lastNotNull'
            ],
            fields: 'intensity',                    
          })
          .setData(
            new SceneDataTransformer({
                $data: queryRunner1,
                transformations: [
                  {
                    'id': 'filterByValue',
                    'options': {
                      'filters': [
                        {
                          'config': {
                            'id': 'equal',
                            'options': {
                              'value': regionName
                            }
                          },
                          'fieldName': 'shortname'
                        }
                      ],
                      'match': 'any',
                      'type': 'include'
                    }
                  }
                ]
              })
          )
          .build(),
    }))
  );

  // Get the intensity for North Scotland...
  const transformer1 = new SceneDataTransformer({
    $data: queryRunner1,
    transformations: [
      {
        'id': 'filterByValue',
        'options': {
          'filters': [
            {
              'config': {
                'id': 'equal',
                'options': {
                  'value': 'North Scotland'
                }
              },
              'fieldName': 'shortname'
            }
          ],
          'match': 'any',
          'type': 'include'
        }
      }
    ]
  });

  // And the intensity for South Wales...
  const transformer2 = new SceneDataTransformer({
    $data: queryRunner1,
    transformations: [
      {
        'id': 'filterByValue',
        'options': {
          'filters': [
            {
              'config': {
                'id': 'equal',
                'options': {
                  'value': 'South Wales'
                }
              },
              'fieldName': 'shortname'
            }
          ],
          'match': 'any',
          'type': 'include'
        }
      }
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
          height: 150,
          body: PanelBuilders.text().setTitle('Simon Panel').setOption('content', 'Well would you look at that.').build(),
        }),
        ...regionPanels,
        // new SceneFlexItem({
        //   width: '20%',
        //   height: 150,
        //   body: 
        //     PanelBuilders
        //       .stat()
        //       .setTitle('North Scotland')
        //       // TODO configure the colour values?
        //       .setOption('reduceOptions', {
        //         calcs: [
        //           'lastNotNull'
        //         ],
        //         fields: 'intensity',                    
        //       })
        //       .setData(transformer1)
        //       .build(),
        // }),
        // new SceneFlexItem({
        //   width: '20%',
        //   height: 150,
        //   body:           
        //     PanelBuilders
        //       .piechart()
        //       .setTitle('North Scotland')
        //       .setOption('reduceOptions', {
        //         calcs: [
        //           'lastNotNull'
        //         ],
        //         fields: 'percentage',
        //         values: true
        //       })
        //       .setOption('pieType', PieChartType.Donut)
        //       .setOption('legend', {
        //         showLegend: false
        //       })
        //       .setData(transformer1)
        //       .build(),
        // }),
        // new SceneFlexItem({
        //   width: '20%',
        //   height: 150,
        //   body: 
        //     PanelBuilders
        //       .stat()
        //       .setTitle('South Wales')
        //       .setOption('reduceOptions', {
        //         calcs: [
        //           'lastNotNull'
        //         ],
        //         fields: 'intensity',                    
        //       })
        //       .setData(transformer2)
        //       .build(),
        // }),
        // new SceneFlexItem({
        //   width: '20%',
        //   height: 150,
        //   body:           
        //     PanelBuilders
        //       .piechart()
        //       .setTitle('South Wales')
        //       .setOption('reduceOptions', {
        //         calcs: [
        //           'lastNotNull'
        //         ],
        //         fields: 'percentage',
        //         values: true
        //       })
        //       .setOption('pieType', PieChartType.Donut)
        //       .setOption('legend', {
        //         showLegend: false
        //       })
        //       .setData(transformer2)
        //       .build(),
        // }),
        new SceneFlexItem({
          width: '100%',
          height: 600,
          body: PanelBuilders.table().setTitle('Data').setData(queryRunner1).build(),
        })
      ],
    }),
  });
}
