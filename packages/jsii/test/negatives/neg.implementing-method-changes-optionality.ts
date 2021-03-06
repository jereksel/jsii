///!MATCH_ERROR: jsii.Implementor#method changes the optionality of paramerter _optional when implementing jsii.IInterface (expected true, found false)

// Attempt to change optionality of method parameter
export interface IInterface {
  method(required: string, optional?: number): void;
}

export class Implementor implements IInterface {
  public method(_required: string, _optional: number): void {
    // ...
  }
}
