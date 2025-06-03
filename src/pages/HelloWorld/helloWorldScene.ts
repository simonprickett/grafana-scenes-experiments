import { EmbeddedScene, SceneDataTransformer, SceneFlexLayout, SceneFlexItem, SceneQueryRunner, PanelBuilders } from '@grafana/scenes';
import { MappingType } from '@grafana/schema';
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

  const regionPanels: Array<SceneFlexItem> = regions.flatMap((regionName) => {
    const transformer = new SceneDataTransformer({
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
    });

    return [ 
      new SceneFlexItem({
        width: '25%',
        height: 150,
        body: 
          PanelBuilders
            .stat()
            .setTitle(regionName)
            .setMappings([
            {
              options: {
                high: {
                  color: "orange",
                },
                low: {
                  color: "green",
                },
                moderate: {
                  color: "yellow",
                },
                'very high': {
                  color: "red",
                },
                'very low': {
                  color: "green",
                }
              },
              type: MappingType.ValueToText
            }

            ])
            .setOption('reduceOptions', {
              calcs: [
                'lastNotNull'
              ],
              fields: 'intensity',                    
            })
            .setData(transformer)
            .build(),
      }),
      new SceneFlexItem({
        width: '25%',
        height: 150,
        body:           
          PanelBuilders
            .piechart()
            .setTitle(regionName)
            .setOption('reduceOptions', {
              calcs: [
                'lastNotNull'
              ],
              fields: 'percentage',
              values: true
            })
            .setOption('pieType', PieChartType.Donut)
            .setOption('legend', {
              showLegend: false
            })
            .setData(transformer)
            .build(),
      }),
    ];
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
