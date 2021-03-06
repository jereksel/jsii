using Amazon.JSII.Runtime.Deputy;

namespace Amazon.JSII.Tests.CalculatorNamespace
{
    /// <remarks>
    /// <strong>Stability</strong>: Experimental
    /// </remarks>
    [JsiiClass(nativeType: typeof(Amazon.JSII.Tests.CalculatorNamespace.AmbiguousParameters), fullyQualifiedName: "jsii-calc.AmbiguousParameters", parametersJson: "[{\"name\":\"scope\",\"type\":{\"fqn\":\"jsii-calc.Bell\"}},{\"name\":\"props\",\"type\":{\"fqn\":\"jsii-calc.StructParameterType\"}}]")]
    public class AmbiguousParameters : DeputyBase
    {
        /// <remarks>
        /// <strong>Stability</strong>: Experimental
        /// </remarks>
        public AmbiguousParameters(Amazon.JSII.Tests.CalculatorNamespace.Bell scope, Amazon.JSII.Tests.CalculatorNamespace.IStructParameterType props): base(new DeputyProps(new object[]{scope, props}))
        {
        }

        /// <summary>Used by jsii to construct an instance of this class from a Javascript-owned object reference</summary>
        /// <param name="reference">The Javascript-owned object reference</param>
        [System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
        protected AmbiguousParameters(ByRefValue reference): base(reference)
        {
        }

        /// <summary>Used by jsii to construct an instance of this class from DeputyProps</summary>
        /// <param name="props">The deputy props</param>
        [System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
        protected AmbiguousParameters(DeputyProps props): base(props)
        {
        }

        /// <remarks>
        /// <strong>Stability</strong>: Experimental
        /// </remarks>
        [JsiiProperty(name: "props", typeJson: "{\"fqn\":\"jsii-calc.StructParameterType\"}")]
        public virtual Amazon.JSII.Tests.CalculatorNamespace.IStructParameterType Props
        {
            get => GetInstanceProperty<Amazon.JSII.Tests.CalculatorNamespace.IStructParameterType>();
        }

        /// <remarks>
        /// <strong>Stability</strong>: Experimental
        /// </remarks>
        [JsiiProperty(name: "scope", typeJson: "{\"fqn\":\"jsii-calc.Bell\"}")]
        public virtual Amazon.JSII.Tests.CalculatorNamespace.Bell Scope
        {
            get => GetInstanceProperty<Amazon.JSII.Tests.CalculatorNamespace.Bell>();
        }
    }
}
