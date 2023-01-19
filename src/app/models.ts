export enum MigrationComponent {
  database,
  archetype,
  dependencies,
  platform,
  devenv

}

export class MigrationStep {
  title: string;
  id: string;
  instructions: string;
  renderedInstructions: string;
  component: MigrationComponent;
  replaces: string;
}

export class MigrationPhases {
  pre?: MigrationStep[] = [];
  during?: MigrationStep[] = [];
  after?: MigrationStep[] = [];
}

export class MigrationTarget {
  version: string;
  wildflyVersion: string;
  postgresqlVersions: string;
  requireDowntime = false;
  phases: MigrationPhases = new MigrationPhases();

  updateRequireDowntime(downtime: boolean): void {
    if(this.requireDowntime == null || !this.requireDowntime)
    {
      this.requireDowntime = downtime != null ?  downtime : false;
    }
  }
}
