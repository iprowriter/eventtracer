import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

/** Convert a camelCase identifier to snake_case (createdAt → created_at). */
function snakeCase(input: string): string {
  return input
    .replace(/([A-Z])([A-Z])([a-z])/g, '$1_$2$3') // handle runs of capitals
    .replace(/([a-z\d])([A-Z])/g, '$1_$2') // the normal camel boundary
    .toLowerCase();
}

/**
 * Maps camelCase entity classes/properties → snake_case tables/columns, so SQL
 * stays quote-free. We hand-roll this (instead of `typeorm-naming-strategies`)
 * because that package's peer range hasn't caught up to typeorm@1.x.
 * TODO: extract to a shared lib once a second service (payment) needs it.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName: string): string {
    return customName ? customName : snakeCase(className);
  }

  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    return snakeCase(
      embeddedPrefixes.concat(customName || propertyName).join('_'),
    );
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName || propertyName}`);
  }
}
