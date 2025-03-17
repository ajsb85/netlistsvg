import Cell from './Cell';
import { SigsByConstName } from './FlatModule';
import Yosys from './YosysModel';
import { ElkModel } from './elkGraph';
export declare class Port {
    parentNode?: Cell;
    private key;
    private value;
    constructor(key: string, value: number[] | Yosys.Signals);
    get Key(): string;
    keyIn(pids: string[]): boolean;
    maxVal(): number;
    valString(): string;
    findConstants(sigsByConstantName: SigsByConstName, maxNum: number, constantCollector: Cell[]): number;
    getGenericElkPort(index: number, templatePorts: any[], dir: string): ElkModel.Port;
    private assignConstant;
}
//# sourceMappingURL=Port.d.ts.map