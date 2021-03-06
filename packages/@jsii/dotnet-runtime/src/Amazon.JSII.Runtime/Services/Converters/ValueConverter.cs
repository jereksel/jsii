﻿using Amazon.JSII.JsonModel.Spec;
using System;
using Newtonsoft.Json.Linq;

namespace Amazon.JSII.Runtime.Services.Converters
{
    internal abstract class ValueConverter
    {
        protected readonly ITypeCache _types;

        protected ValueConverter(ITypeCache types)
        {
            _types = types ?? throw new ArgumentNullException(nameof(types));
        }

        protected bool TryConvert(TypeReference typeReference, System.Type type, IReferenceMap referenceMap, object value, out object result)
        {
            return TryConvert(new OptionalValue(typeReference), type, referenceMap, value, out result);
        }

        public bool TryConvert(IOptionalValue optionalValue, System.Type type, IReferenceMap referenceMap, object value, out object result)
        {
            if (optionalValue == null)
            {
                return TryConvertVoid(value, out result);
            }

            if (optionalValue.Type.FullyQualifiedName != null)
            {
                return TryConvertCustomType(type, referenceMap, value, optionalValue.IsOptional, optionalValue.Type.FullyQualifiedName, out result);
            }

            if (optionalValue.Type.Primitive != null)
            {
                return TryConvertPrimitive(type, referenceMap, value, optionalValue.IsOptional, optionalValue.Type.Primitive.Value, out result);
            }

            if (optionalValue.Type.Collection != null)
            {
                return TryConvertCollection(referenceMap, value, optionalValue.IsOptional, optionalValue.Type.Collection, out result);
            }

            if (optionalValue.Type.Union != null)
            {
                return TryConvertUnion(type, referenceMap, value, optionalValue.IsOptional, optionalValue.Type.Union, out result);
            }

            throw new ArgumentException("Invalid type reference", nameof(optionalValue));
        }

        protected bool IsNumeric(System.Type type)
        {
            return
                typeof(short).IsAssignableFrom(type) ||
                typeof(ushort).IsAssignableFrom(type) ||
                typeof(int).IsAssignableFrom(type) ||
                typeof(uint).IsAssignableFrom(type) ||
                typeof(long).IsAssignableFrom(type) ||
                typeof(ulong).IsAssignableFrom(type) ||
                typeof(float).IsAssignableFrom(type) ||
                typeof(double).IsAssignableFrom(type);
        }

        protected abstract bool TryConvertVoid(object value, out object result);

        protected abstract bool TryConvertClass(System.Type type, IReferenceMap referenceMap, object value, out object result);

        protected abstract bool TryConvertEnum(object value, bool isOptional, string fullyQualifiedName, out object result);

        protected abstract bool TryConvertBoolean(object value, bool isOptional, out object result);

        protected abstract bool TryConvertDate(object value, bool isOptional, out object result);

        protected abstract bool TryConvertJson(object value, out object result);

        protected abstract bool TryConvertNumber(object value, bool isOptional, out object result);

        protected abstract bool TryConvertString(object value, out object result);

        protected abstract bool TryConvertArray(IReferenceMap referenceMap, TypeReference elementType, object value, out object result);

        protected abstract bool TryConvertMap(IReferenceMap referenceMap, TypeReference elementType, object value, out object result);

        protected abstract TypeReference InferType(IReferenceMap referenceMap, object value);

        object ConvertAny(System.Type type, IReferenceMap referenceMap, object value)
        {
            if (value == null)
            {
                return null;
            }

            TypeReference reference = InferType(referenceMap, value);
            if (TryConvert(reference, type, referenceMap, value, out object result))
            {
                return result;
            }

            throw new ArgumentException($"Could not convert value '{value}' with unrecognized type", nameof(value));
        }

        bool TryConvertCustomType(System.Type type, IReferenceMap referenceMap, object value, bool isOptional, string fullyQualifiedName, out object result)
        {
            if (IsReferenceType())
            {
                return TryConvertClass(type, referenceMap, value, out result);
            }

            if (_types.GetEnumType(fullyQualifiedName) != null)
            {
                return TryConvertEnum(value, isOptional, fullyQualifiedName, out result);
            }

            result = null;
            return false;

            bool IsReferenceType()
            {
                return
                    _types.GetClassType(fullyQualifiedName) != null ||
                    _types.GetInterfaceType(fullyQualifiedName) != null ||
                    _types.GetProxyType(fullyQualifiedName) != null;
            }
        }

        bool TryConvertPrimitive(System.Type type, IReferenceMap referenceMap, object value, bool isOptional, PrimitiveType primitiveType, out object result)
        {
            switch (primitiveType)
            {
                case PrimitiveType.Any:
                    result = ConvertAny(type, referenceMap, value);
                    return true;

                case PrimitiveType.Boolean:
                    return TryConvertBoolean(value, isOptional, out result);

                case PrimitiveType.Date:
                    return TryConvertDate(value, isOptional, out result);

                case PrimitiveType.Json:
                    return TryConvertJson(value, out result);

                case PrimitiveType.Number:
                    return TryConvertNumber(value, isOptional, out result);

                case PrimitiveType.String:
                    return TryConvertString(value, out result);

                default:
                    throw new ArgumentException($"Unknown primitive type '{primitiveType}'", nameof(primitiveType));
            }
        }

        bool TryConvertCollection(IReferenceMap referenceMap, object value, bool isOptional, CollectionTypeReference collectionType, out object result)
        {
            switch (collectionType.Kind)
            {
                case CollectionKind.Array:
                    return TryConvertArray(referenceMap, collectionType.ElementType, value, out result);
                case CollectionKind.Map:
                    return TryConvertMap(referenceMap, collectionType.ElementType, value, out result);
                default:
                    throw new ArgumentException($"Unknown collection kind '{collectionType.Kind}'", nameof(collectionType));
            }
        }

        bool TryConvertUnion(System.Type type, IReferenceMap referenceMap, object value, bool isOptional, UnionTypeReference unionType, out object result)
        {
            foreach (var candidateType in unionType.Types)
            {
                if (TryConvert(candidateType, type, referenceMap, value, out result))
                {
                    return true;
                }
            }

            result = null;
            return false;
        }
    }
}
