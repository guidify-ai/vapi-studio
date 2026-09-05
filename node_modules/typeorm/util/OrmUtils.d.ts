import { DeepPartial } from "../common/DeepPartial";
import { ObjectLiteral } from "../common/ObjectLiteral";
import { PrimitiveCriteria, SinglePrimitiveCriteria } from "../common/PrimitiveCriteria";
import type { InvalidFindOptionsWhereBehavior } from "../driver/types/InvalidFindOptionsWhereBehavior";
export declare class OrmUtils {
    /**
     * Chunks array into pieces.
     */
    static chunk<T>(array: T[], size: number): T[][];
    static splitClassesAndStrings<T>(classesAndStrings: (string | T)[]): [T[], string[]];
    static groupBy<T, R>(array: T[], propertyCallback: (item: T) => R): {
        id: R;
        items: T[];
    }[];
    static uniq<T>(array: T[], criteria?: (item: T) => unknown): T[];
    static uniq<T, K extends keyof T>(array: T[], property: K): T[];
    /**
     * Deep Object.assign.
     */
    static mergeDeep<T>(target: T, ...sources: (DeepPartial<T> | undefined)[]): T;
    /**
     * Creates a shallow copy of the object, without invoking the constructor
     */
    static cloneObject<T extends object>(object: T): T;
    /**
     * Deep compare objects.
     *
     * @see http://stackoverflow.com/a/1144249
     */
    static deepCompare<T>(...args: T[]): boolean;
    /**
     * Gets deeper value of object.
     */
    static deepValue(obj: ObjectLiteral, path: string): any;
    static replaceEmptyObjectsWithBooleans(obj: any): void;
    static propertyPathsToTruthyObject(paths: string[]): any;
    /**
     * Check if two entity-id-maps are the same
     */
    static compareIds(firstId: ObjectLiteral | undefined, secondId: ObjectLiteral | undefined): boolean;
    /**
     * Transforms given value into boolean value.
     */
    static toBoolean(value: any): boolean;
    /**
     * Checks if two arrays of unique values contain the same values
     */
    static isArraysEqual<T>(arr1: T[], arr2: T[]): boolean;
    static areMutuallyExclusive<T>(...lists: T[][]): boolean;
    /**
     * Parses the CHECK constraint on the specified column and returns
     * all values allowed by the constraint or undefined if the constraint
     * is not present.
     */
    static parseSqlCheckExpression(sql: string, columnName: string): string[] | undefined;
    /**
     * Checks whether the given criteria is null or wholly empty — `null`,
     * `undefined`, `""`, an empty array, or an empty plain object. Does not
     * recurse into array elements, so it is safe on self-referential/cyclic
     * arrays. Per-element OR-branch emptiness (an array containing an empty
     * element) is handled where object criteria is validated, not here.
     *
     * @param criteria
     */
    static isCriteriaNullOrEmpty(criteria: unknown): boolean;
    /**
     * Checks if given criteria is a primitive value.
     * Primitive values are strings, numbers and dates.
     */
    static isSinglePrimitiveCriteria(criteria: unknown): criteria is SinglePrimitiveCriteria;
    /**
     * Checks if given criteria is a primitive value or an array of primitive values.
     */
    static isPrimitiveCriteria(criteria: unknown): criteria is PrimitiveCriteria;
    private static compare2Objects;
    private static isPlainObject;
    private static mergeArrayKey;
    private static mergeObjectKey;
    private static merge;
    /**
     * Applies invalidWhereValuesBehavior to a plain-object where criteria: for
     * each own key a null/undefined value is thrown on, skipped, or converted
     * to IsNull() per the configured behavior. Only plain FindOptionsWhere
     * objects are normalized; anything else (entity/class instances,
     * FindOperators, arrays, Date, Buffer, primitives) — and the criteria when
     * no behavior is configured — is returned untouched.
     *
     * @param criteria
     * @param options
     * @param path
     */
    static normalizeWhereCriteria(criteria: any, options?: InvalidFindOptionsWhereBehavior, path?: string): any;
}
