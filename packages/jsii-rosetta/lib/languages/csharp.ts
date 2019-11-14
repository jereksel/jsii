import ts = require('typescript');
import { DefaultVisitor } from './default';
import { AstRenderer } from '../renderer';
import { OTree } from '../o-tree';
import { getNonUndefinedTypeFromUnion, builtInTypeName, typeContainsUndefined, parameterAcceptsUndefined, mapElementType } from '../typescript/types';
import { flat } from '../util';
import { matchAst, nodeOfType, quoteStringLiteral } from '../typescript/ast-utils';

interface CSharpLanguageContext {
  /**
   * Used to render the constructor's name
   */
  readonly currentClassName?: string;

  /**
   * Used to capitalize member accesses
   */
  readonly propertyOrMethod: boolean;

  /**
   * So we know how to render property signatures
   */
  readonly inStructInterface: boolean;

  /**
   * So we know how to render property assignments
   */
  readonly inKeyValueList: boolean;

  /**
   * Whether a string literal is currently in the position of having to render as an identifier (LHS in property assignment)
   */
  readonly stringAsIdentifier: boolean;

  /**
   * Whether an identifier literal is currently in the position of having to render as a string (LHS in property assignment)
   */
  readonly identifierAsString: boolean;

  /**
   * When parsing an object literal and no type information is available, prefer parsing it as a struct to parsing it as a map
   */
  readonly preferObjectLiteralAsStruct: boolean;
}

type CSharpRenderer = AstRenderer<CSharpLanguageContext>;

export class CSharpVisitor extends DefaultVisitor<CSharpLanguageContext> {
  readonly defaultContext = {
    propertyOrMethod: false,
    inStructInterface: false,
    inKeyValueList: false,
    stringAsIdentifier: false,
    identifierAsString: false,
    preferObjectLiteralAsStruct: true
  };

  public mergeContext(old: CSharpLanguageContext, update: Partial<CSharpLanguageContext>): CSharpLanguageContext {
    return Object.assign({}, old, update);
  }

  public identifier(node: ts.Identifier | ts.StringLiteral, renderer: CSharpRenderer) {
    let text = node.text;

    if (renderer.currentContext.identifierAsString) {
      return new OTree([JSON.stringify(text)]);
    }

    // Uppercase methods and properties, leave the rest as-is
    if (renderer.currentContext.propertyOrMethod) {
      text = text.substr(0, 1).toUpperCase() + text.substr(1);
    }

    return new OTree([text]);
  }

  public functionDeclaration(node: ts.FunctionDeclaration, renderer: CSharpRenderer): OTree {
    return this.functionLike(node, renderer);
  }

  public constructorDeclaration(node: ts.ConstructorDeclaration, renderer: CSharpRenderer): OTree {
    return this.functionLike(node, renderer, { isConstructor: true });
  }

  public methodDeclaration(node: ts.MethodDeclaration, renderer: CSharpRenderer): OTree {
    return this.functionLike(node, renderer);
  }

  // tslint:disable-next-line:max-line-length
  public functionLike(node: ts.FunctionLikeDeclarationBase, renderer: CSharpRenderer, opts: { isConstructor?: boolean } = {}): OTree {
    const methodName = opts.isConstructor ? renderer.currentContext.currentClassName || 'MyClass' : renderer.updateContext({ propertyOrMethod: true }).convert(node.name);
    const returnType = opts.isConstructor ? '' : this.renderTypeNode(node.type, false, renderer);

    const ret = new OTree([
      'public ',
      returnType,
      ' ',
      methodName,
      '(',
      new OTree([], renderer.convertAll(node.parameters), { separator: ', ' }),
      ') ',
    ], [renderer.convert(node.body)], {
      canBreakLine: true
    });

    return ret;
  }

  public printStatement(args: ts.NodeArray<ts.Expression>, renderer: CSharpRenderer) {
    const renderedArgs = args.length === 1
      ? renderer.convertAll(args)
      : ['$"',
        new OTree([], args.map(a => new OTree(['{', renderer.convert(a), '}'])), { separator: ' ' }),
        '"']

    return new OTree([
      'Console.WriteLine(',
      ...renderedArgs,
      ')'
    ]);
  }

  public stringLiteral(node: ts.StringLiteral, renderer: CSharpRenderer): OTree {
    if (renderer.currentContext.stringAsIdentifier) {
      return this.identifier(node, renderer);
    } else {
      return new OTree([JSON.stringify(node.text)]);
    }
  }

  public expressionStatement(node: ts.ExpressionStatement, renderer: CSharpRenderer): OTree {
    return new OTree([renderer.convert(node.expression), ';'], [], { canBreakLine: true });
  }

  public propertyAccessExpression(node: ts.PropertyAccessExpression, renderer: CSharpRenderer): OTree {
    const objectExpression = renderer.textOf(node.expression) === 'this' ? [] : [renderer.updateContext({ propertyOrMethod: false }).convert(node.expression), '.'];
    return new OTree([...objectExpression, renderer.updateContext({ propertyOrMethod: true }).convert(node.name)]);
  }

  public parameterDeclaration(node: ts.ParameterDeclaration, renderer: CSharpRenderer): OTree {
    return new OTree([
      this.renderTypeNode(node.type, node.questionToken !== undefined, renderer),
      ' ',
      renderer.convert(node.name),
      ...parameterAcceptsUndefined(node, node.type && renderer.typeOfType(node.type)) ? ['=', node.initializer ? renderer.convert(node.initializer) : 'null'] : []
    ]);
  }

  public propertySignature(node: ts.PropertySignature, renderer: CSharpRenderer): OTree {
    return new OTree([
      'public ',
      this.renderTypeNode(node.type, node.questionToken !== undefined, renderer),
      ' ',
      renderer.updateContext({ propertyOrMethod: true }).convert(node.name),
      ';',
    ], [], { canBreakLine: true });
  }

  /**
   * Do some work on property accesses to translate common JavaScript-isms to language-specific idioms
   */
  public regularCallExpression(node: ts.CallExpression, renderer: CSharpRenderer): OTree {
    return new OTree([
      renderer.updateContext({ propertyOrMethod: true }).convert(node.expression),
      '(',
      new OTree([], renderer.convertAll(node.arguments), { separator: ', ' }),
      ')']);
  }

  public classDeclaration(node: ts.ClassDeclaration, renderer: CSharpRenderer): OTree {
    return new OTree(
      [
        'class ',
        renderer.convert(node.name),
        ...this.classHeritage(node, renderer),
        '\n{',
      ],
      renderer.convertAll(node.members),
      {
        indent: 4,
        canBreakLine: true,
        suffix: '\n}',
      },
    );
  }

  public structInterfaceDeclaration(node: ts.InterfaceDeclaration, renderer: CSharpRenderer): OTree {
    return new OTree([
      'class ',
      renderer.convert(node.name),
      ...this.classHeritage(node, renderer),
      '\n{',
    ],
    renderer.updateContext({ inStructInterface: true }).convertAll(node.members),
    {
      indent: 4,
      canBreakLine: true,
      suffix: '\n}'
    });
  }

  public regularInterfaceDeclaration(node: ts.InterfaceDeclaration, renderer: CSharpRenderer): OTree {
    return new OTree([
      'interface ',
      renderer.convert(node.name),
      ...this.classHeritage(node, renderer),
      '\n{',
    ],
    renderer.convertAll(node.members),
    {
      indent: 4,
      canBreakLine: true,
      suffix: '\n}'
    });
  }

  public block(node: ts.Block, children: CSharpRenderer): OTree {
    return new OTree(['\n{'], [...children.convertAll(node.statements)], {
      indent: 4,
      suffix: '\n}',
    });
  }

  public unknownTypeObjectLiteralExpression(node: ts.ObjectLiteralExpression, renderer: CSharpRenderer): OTree {
    if (renderer.currentContext.preferObjectLiteralAsStruct) {
      // Type information missing and from context we prefer a struct
      return new OTree(['new Struct { '], renderer.convertAll(node.properties), { suffix: ' }', separator: ', ', indent: 4 });
    } else {
      // Type information missing and from context we prefer a map
      return this.keyValueObjectLiteralExpression(node, undefined, renderer);
    }
  }

  public knownStructObjectLiteralExpression(node: ts.ObjectLiteralExpression, structType: ts.Type, renderer: CSharpRenderer): OTree {
    return new OTree(['new ', structType.symbol.name, ' { '], renderer.convertAll(node.properties), { suffix: ' }', separator: ', ', indent: 4 });
  }

  public keyValueObjectLiteralExpression(node: ts.ObjectLiteralExpression, valueType: ts.Type | undefined, renderer: CSharpRenderer): OTree {
    // Try to infer an element type from the elements
    // Adam: commenting out because it doesn't compile (no inferMapElement function exists)
    // if (valueType === undefined) {
    //   valueType = inferMapElementType(node.properties, renderer);
    // }

    return new OTree([
      'new Dictionary<string, ',
      valueType ? this.renderType(node, valueType, false, renderer) : 'object',
      '> { '], renderer.updateContext({ inKeyValueList: true }).convertAll(node.properties), { suffix: ' }', separator: ', ', indent: 4, });
  }

  public shorthandPropertyAssignment(node: ts.ShorthandPropertyAssignment, renderer: CSharpRenderer): OTree {
    return this.renderPropertyAssignment(node.name, node.name, renderer);
  }

  public propertyAssignment(node: ts.PropertyAssignment, renderer: CSharpRenderer): OTree {
    return this.renderPropertyAssignment(node.name, node.initializer, renderer);
  }

  public renderPropertyAssignment(key: ts.Node, value: ts.Node, renderer: CSharpRenderer): OTree {
    if (renderer.currentContext.inKeyValueList) {
      return new OTree(['{ ', renderer.updateContext({ propertyOrMethod: false, identifierAsString: true }).convert(key), ', ', renderer.updateContext({ inKeyValueList: false }).convert(value), ' }'], [], { canBreakLine: true });
    } else {
      return new OTree([renderer.updateContext({ propertyOrMethod: true, stringAsIdentifier: true }).convert(key), ' = ', renderer.convert(value)], [], { canBreakLine: true });
    }
  }

  public arrayLiteralExpression(node: ts.ArrayLiteralExpression, renderer: CSharpRenderer): OTree {
    return new OTree(['new [] { '], renderer.convertAll(node.elements), {
      separator: ', ',
      suffix: ' }',
      indent: 4,
    });
  }

  public ifStatement(node: ts.IfStatement, renderer: CSharpRenderer): OTree {
    const ifStmt = new OTree(
      ['if (', renderer.convert(node.expression), ') '],
      [renderer.convert(node.thenStatement)], { canBreakLine: true });
    const elseStmt = node.elseStatement ? new OTree([`else `], [renderer.convert(node.elseStatement)], { canBreakLine: true }) : undefined;

    return elseStmt ? new OTree([], [ifStmt, elseStmt], {
      separator: '\n',
      canBreakLine: true
    }) : ifStmt;
  }

  public forOfStatement(node: ts.ForOfStatement, renderer: CSharpRenderer): OTree {
    // This is what a "for (const x of ...)" looks like in the AST
    let variableName = '???';

    matchAst(node.initializer,
      nodeOfType(ts.SyntaxKind.VariableDeclarationList,
        nodeOfType('var', ts.SyntaxKind.VariableDeclaration)),
      bindings => {
        variableName = renderer.textOf(bindings.var.name);
      });

    return new OTree([
      'for (var ',
      variableName,
      ' in ',
      renderer.convert(node.expression),
      ') '
    ], [renderer.convert(node.statement)], { canBreakLine: true });
  }

  public asExpression(node: ts.AsExpression, context: CSharpRenderer): OTree {
    return new OTree(['(', this.renderTypeNode(node.type, false, context), ')', context.convert(node.expression)]);
  }

  public variableDeclaration(node: ts.VariableDeclaration, renderer: CSharpRenderer): OTree {
    const type = (node.type && renderer.typeOfType(node.type))
        || (node.initializer && renderer.typeOfExpression(node.initializer));

    let renderedType = type ? this.renderType(node, type, false, renderer) : 'var';
    if (renderedType === 'object') { renderedType = 'var'; }

    return new OTree([
      renderedType,
      ' ',
      renderer.convert(node.name),
      ' = ',
      renderer.updateContext({ preferObjectLiteralAsStruct: false }).convert(node.initializer),
      ';'
    ], [], { canBreakLine: true });
  }

  public templateExpression(node: ts.TemplateExpression, context: CSharpRenderer): OTree {
    const parts = ['$"'];
    if (node.head.rawText) { parts.push(quoteStringLiteral(node.head.rawText)); }
    for (const span of node.templateSpans) {
      parts.push('{' + context.textOf(span.expression) + '}');
      if (span.literal.rawText) { parts.push(quoteStringLiteral(span.literal.rawText)); }
    }
    parts.push('"');

    return new OTree([parts.join('')]);
  }

  private renderTypeNode(typeNode: ts.TypeNode | undefined, questionMark: boolean, renderer: CSharpRenderer): string {
    if (!typeNode) { return 'void'; }
    return this.renderType(typeNode, renderer.typeOfType(typeNode), questionMark, renderer);
  }

  private renderType(typeNode: ts.Node, type: ts.Type, questionMark: boolean, renderer: CSharpRenderer): string {
    const nonUnionType = getNonUndefinedTypeFromUnion(type);
    if (!nonUnionType) {
      renderer.report(typeNode, 'Type unions in examples are not supported');
      return '...';
    }

    const mappedTo = mapElementType(nonUnionType);
    if (mappedTo) {
      return `IDictionary<string, ${this.renderType(typeNode, mappedTo, questionMark, renderer)}>`;
    }

    return typeNameFromType(nonUnionType) + (typeContainsUndefined(type) || questionMark ? '?' : '');
  }

  private classHeritage(node: ts.ClassDeclaration | ts.InterfaceDeclaration, renderer: CSharpRenderer) {
    const heritage = flat(Array.from(node.heritageClauses || []).map(h => Array.from(h.types))).map(t => renderer.convert(t.expression));

    return heritage.length > 0 ? [' : ', new OTree([], heritage, { separator: ', ' })] : [];
  }
}

function typeNameFromType(type: ts.Type): string {
  // User-defined or aliased type
  if (type.aliasSymbol) { return type.aliasSymbol.name; }
  if (type.symbol) { return type.symbol.name; }

  // Built-in type (?)
  return csharpTypeName(builtInTypeName(type));
}

function csharpTypeName(jsTypeName: string | undefined): string {
  if (jsTypeName === undefined) { return '???'; }
  switch (jsTypeName) {
    case 'number': return 'int';
    case 'any': return 'object';
  }
  return jsTypeName;
}
