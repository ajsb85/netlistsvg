import { ElkModel } from '../lib/elkGraph';
import { removeDummyEdges } from '../lib/drawModule';

test('remove dummy edges outputs', () => {
    const e2end = {x: 249, y: 162};
    const e3end = {x: 249, y: 97};
    const e4end = {x: 249, y: 32};
    const dummyPos = {x: 214, y: 32};
    const highJunct = {x: 224, y: 32};
    const lowJunct = {x: 224, y: 97};

    const testGraph: ElkModel.Graph = {
        id: 'fake id',
        children: [],
        edges: [
            {
                id: 'e2',
                source: '$d_0',
                sourcePort: '$d_0.p',
                target: 'o1',
                targetPort: 'o1.A',
                sections: [
                    {
                        id: 'e2_s0',
                        startPoint: dummyPos,
                        endPoint: e2end,
                        bendPoints: [
                            {x: 224, y: 32},
                            {x: 224, y: 162},
                        ],
                    },
                ],
                junctionPoints: [highJunct],
            },
            {
                id: 'e3',
                source: '$d_0',
                sourcePort: '$d_0.p',
                target: 'o2',
                targetPort: 'o2.A',
                sections: [
                    {
                        id: 'e3_s0',
                        startPoint: dummyPos,
                        endPoint: e3end,
                        bendPoints: [
                            {x: 224, y: 32},
                            {x: 224, y: 97},
                        ],
                    },
                ],
                junctionPoints: [lowJunct],
            },
            {
                id: 'e4',
                source: '$d_0',
                sourcePort: '$d_0.p',
                target: 'o3',
                targetPort: 'o3.A',
                sections: [
                    {
                        id: 'e4_s0',
                        startPoint: dummyPos,
                        endPoint: e4end,
                    },
                ],
            },
        ],
    };
    removeDummyEdges(testGraph);
    const junctionPoints = testGraph.edges.flatMap((edge) => (edge as ElkModel.Edge).junctionPoints || []);
    expect(junctionPoints.length).toEqual(1);
});

test('remove dummy edges inputs', () => {
    const e5Start = {x: 159, y: 162};
    const e6Start = {x: 159, y: 97};
    const e7Start = {x: 159, y: 32};
    const initEnd = {x: 202, y: 97};
    const junctPoint = {x: 177, y: 97};

    const testGraph: ElkModel.Graph = {
        id: 'fake id',
        children: [],
        edges: [
            {
                id: 'e5',
                source: 'i0',
                sourcePort: 'i0.Y',
                target: '$d_0',
                targetPort: '$d_0.p',
                sections: [
                    {
                        id: 'e5_s0',
                        startPoint: e5Start,
                        endPoint: initEnd,
                        bendPoints: [
                            {x: 177, y: 162},
                            {x: 177, y: 97},
                        ],
                    },
                ],
            },
            {
                id: 'e6',
                source: 'i1',
                sourcePort: 'i1.Y',
                target: '$d_0',
                targetPort: '$d_0.p',
                sections: [
                    {
                        id: 'e6_s0',
                        startPoint: e6Start,
                        endPoint: initEnd,
                    },
                ],
            },
            {
                id: 'e7',
                source: 'i4',
                sourcePort: 'i4.Y',
                target: '$d_0',
                targetPort: '$d_0.p',
                sections: [
                    {
                        id: 'e7_s0',
                        startPoint: e7Start,
                        endPoint: initEnd,
                        bendPoints: [
                            {x: 177, y: 32},
                            {x: 177, y: 97},
                        ],
                    },
                ],
                junctionPoints: [junctPoint],
            },
        ],
    };
    removeDummyEdges(testGraph);
    const junctionPoints = testGraph.edges.flatMap((edge) => (edge as ElkModel.Edge).junctionPoints || []);
    expect(junctionPoints.length).toEqual(1);
});
