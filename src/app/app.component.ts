import { Component, HostListener, ViewChild } from '@angular/core';
import { MigrationTarget, MigrationStep } from './models';
import { Location } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { Pair, parse as parseYaml } from 'yaml';
import { HttpClient } from '@angular/common/http';
import { SemVer, compare as semverCmp } from 'semver';
import { MatTable } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import * as MarkdownIt from 'markdown-it';


interface Dependency {
  component: string;
  version: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  providers: []
})
export class AppComponent {
  title = 'IOM Update Guide';


  versionTable: Dependency[] = [];
  @ViewChild(MatTable)
  requirementsTable: MatTable<Dependency>;

  displayedColumns: string[] = ['component', 'version'];
  md: MarkdownIt = new MarkdownIt();

  globalRecomms: MigrationTarget;
  newRecomms: MigrationTarget[] = [];
  allInstructions: MigrationTarget = new MigrationTarget();
  stepsToSkip: string[] = [];
  parameterMap: Record<string, string> = {};

  versions: SemVer[] = [
    ver('4.5.0'),
    ver('4.4.0'),
    ver('3.5.0'),
    ver('3.3.0')
  ];
  from = this.versions[1];
  to = this.versions[0];

  /**
   * Only save the locale in the URL if it was already there, or the user changed it
   */
  saveLocale = false;


  constructor(
    public location: Location,
    //public i18Service: I18nPipe,
    private clipboard: Clipboard,
    httpClient: HttpClient
  ) {
    const searchParams = new URLSearchParams(window.location.search);
    // Detect settings in URL
    //currentLocale.locale = searchParams.get('locale') || navigator.language;
    if (searchParams.get('locale')) {
      this.saveLocale = true;
    }
    const versions = searchParams.get('v');

    // Detect versions of from and to
    if (versions) {
      const [from, to] = versions.split('-');
      this.from = this.versions.find((version) => version.version === from);
      this.to = this.versions.find((version) => version.version === to);
    }

    forkJoin([httpClient.get('assets/migrate.yaml', { responseType: 'text' }),
    httpClient.get('assets/global_steps.yaml', { responseType: 'text' })]).subscribe(([migrateSteps, globalMigrateSteps]) => {
      this.newRecomms = <MigrationTarget[]>parseYaml(migrateSteps);
      // sort in ascending order
      this.newRecomms.sort((a, b) => semverCmp(a.version, b.version));
      this.globalRecomms = (<MigrationTarget[]>parseYaml(globalMigrateSteps))[0];
      this.showUpdatePath();
    });


  }

  @HostListener('click', ['$event.target'])
  copyCode({ tagName, textContent }) {
    if (tagName === 'CODE') {
      this.clipboard.copy(textContent);
    }
  }

  renderTarget(migrationTarget: MigrationTarget) {
    this.renderSteps(migrationTarget.phases.pre);
    this.renderSteps(migrationTarget.phases.during);
    this.renderSteps(migrationTarget.phases.after);
  }

  renderSteps(steps: MigrationStep[]) {
    if (steps == null || steps.length < 1) {
      return;
    }
    steps.forEach(step => {
      step.renderedInstructions = this.md.render(this.replaceVariables(step.instructions));
    })
  }

  showUpdatePath() {
    this.allInstructions = new MigrationTarget();
    this.stepsToSkip = [];
    this.versionTable = [];

    // Refuse to generate recommendations for downgrades
    if (this.to.compare(this.from) < 0) {
      alert('We do not support downgrading versions of Angular.');
      return;
    }

    //const labelTitle = this.i18Service.transform('Guide to update your Angular application');
    const labelTitle = 'Guide to update IOM';

    this.title =
      `${labelTitle} v${this.from.version} -> v${this.to.version}`;
    let curVersion: SemVer;

    this.allInstructions.phases.pre.push(...(this.globalRecomms.phases.pre || []));
    this.allInstructions.phases.during.push(...(this.globalRecomms.phases.during || []));
    this.allInstructions.phases.after.push(...(this.globalRecomms.phases.after || []));

    for (const migrationVersion of this.newRecomms) {
      curVersion = new SemVer(migrationVersion.version);
      if (curVersion.compare(this.from) <= 0) {
        continue;
      }
      if (curVersion.compare(this.to) > 0) {
        break;
      }

      this.allInstructions.updateRequireDowntime(migrationVersion.requireDowntime);
      this.allInstructions.postgresqlVersions = migrationVersion.postgresqlVersions;
      this.allInstructions.wildflyVersion = migrationVersion.wildflyVersion;
      this.allInstructions.iomHelmVersion = migrationVersion.iomHelmVersion;

      const arraysToSort: Pair<MigrationStep[], MigrationStep[]>[] = [];

      arraysToSort.push(new Pair(migrationVersion.phases.pre, this.allInstructions.phases.pre),
        new Pair(migrationVersion.phases.during, this.allInstructions.phases.during),
        new Pair(migrationVersion.phases.after, this.allInstructions.phases.after));

      arraysToSort.forEach(pair => {
        if (pair.key != null) {
          pair.key.forEach(step => {
            pair.value.push(step);
            if (step.replaces != null) {
              this.stepsToSkip.push(step.replaces);
            }
            step.renderedInstructions = this.md.render(this.replaceVariables(step.instructions));
          })
        }
      });
    }
    this.versionTable.push({ component: 'PostgreSQL', version: this.allInstructions.postgresqlVersions },
      { component: 'WildFly', version: this.allInstructions.wildflyVersion },
      { component: 'IOM Helm Charts (min. Version)', version: this.allInstructions.iomHelmVersion });
    this.parameterMap.iomToVersion = this.to.version;
    this.parameterMap.wildflyVersion = this.allInstructions.wildflyVersion;
    this.parameterMap.iomHelmVersion = this.allInstructions.iomHelmVersion;
    this.renderTarget(this.globalRecomms);

    // Update the URL so users can link to this transition
    const searchParams = new URLSearchParams();
    //if (currentLocale.locale && this.saveLocale) {
    //  searchParams.set('locale', currentLocale.locale);
    //}
    searchParams.set('v', `${this.from.version}-${this.to.version}`);
    this.location.replaceState('', searchParams.toString());
  }

  replaceVariables(action: string) {
    let newAction = action;
    newAction = newAction.replace(/\${\w+}/g, rpl => this.replacer(rpl, this.parameterMap));
    return newAction;
  }

  replacer(substring: string, parameterMap: Record<string, string>) {
    const key = substring.match(/\${(\w+)}/)[1];
    return parameterMap[key];
  }

  getVersion(newVersion: string) {
    return this.versions.find((version) => version.version === newVersion);
  }

  setLocale(locale: string) {
    //currentLocale.locale = locale;
    this.saveLocale = true;
    this.showUpdatePath();
  }
}


// convenience
function ver(version: string): SemVer {
  return new SemVer(version);
}
