import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { MigrationTarget, MigrationStep } from './models';
import { Location } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import  { Pair, parse as parseYaml }  from 'yaml';
import  { HttpClient } from '@angular/common/http';
import { SemVer, compare as semverCmp } from 'semver';
import { MatTable } from '@angular/material/table';
import { forkJoin, Observable, Subscription } from 'rxjs';
import * as MarkdownIt from 'markdown-it';
import { RouteConfigLoadEnd } from '@angular/router';


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
  title = 'Angular Update Guide';


  versionTable: Dependency[] = [];
  @ViewChild(MatTable)
  requirementsTable: MatTable<Dependency>;

  displayedColumns: string[] = ['component', 'version'];
  md: MarkdownIt = new MarkdownIt();

  globalRecomms: MigrationTarget;
  newRecomms: MigrationTarget[] = [];
  allInstructions: MigrationTarget = new MigrationTarget();
  stepsToSkip: string[] = [];
  parameterMap: any = {};

  versions: SemVer[] = [
    ver('4.5.0'),
    ver('4.4.0'),
    ver('3.5.0'),
    ver('3.3.0')
  ];
  from = this.versions[1];
  to = this.versions[0];
//  futureVersion = 1600
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

    forkJoin([httpClient.get('assets/migrate.yaml', {responseType: 'text'}),
    httpClient.get('assets/global_steps.yaml', {responseType: 'text'})]).subscribe(([migrateSteps, globalMigrateSteps]) => {
      this.newRecomms = <MigrationTarget[]>parseYaml(migrateSteps);
      // sort in ascending order
      this.newRecomms.sort((a,b) => semverCmp(a.version, b.version));
      this.globalRecomms = (<MigrationTarget[]>parseYaml(globalMigrateSteps))[0];
      this.showUpdatePath();
    });


  }

  @HostListener('click', ['$event.target'])
  copyCode({tagName, textContent}) {
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
    if(steps == null || steps.length < 1) {
      return;
    }
    steps.forEach(step => {
      console.log(this.replaceVariables(step.instructions));
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

    // FIXME refactor...

    if(this.globalRecomms.phases.pre)
    {
      this.allInstructions.phases.pre.push(...this.globalRecomms.phases.pre);
    }

    if(this.globalRecomms.phases.during)
    {
      this.allInstructions.phases.during.push(...this.globalRecomms.phases.during);
    }

    if(this.globalRecomms.phases.after)
    {
      this.allInstructions.phases.after.push(...this.globalRecomms.phases.after);
    }

    
    for (const migrationVersion of this.newRecomms) {
      curVersion = new SemVer(migrationVersion.version);
      if(curVersion.compare(this.from) <= 0) {
        continue;
      }
      if(curVersion.compare(this.to) > 0) {
        break;
      }

      this.allInstructions.updateRequireDowntime(migrationVersion.requireDowntime);
      this.allInstructions.postgresqlVersions = migrationVersion.postgresqlVersions;
      this.allInstructions.wildflyVersion = migrationVersion.wildflyVersion;

      let arraysToSort: Pair<MigrationStep[], MigrationStep[]>[] = [];

      arraysToSort.push(new Pair(migrationVersion.phases.pre, this.allInstructions.phases.pre), 
        new Pair(migrationVersion.phases.during, this.allInstructions.phases.during), 
        new Pair(migrationVersion.phases.after, this.allInstructions.phases.after));

      arraysToSort.forEach(pair => {
        if(pair.key != null) {
          pair.key.forEach(step => {
            pair.value.push(step);
            if(step.replaces != null) {
              this.stepsToSkip.push(step.replaces);
            }
            step.renderedInstructions = this.md.render(this.replaceVariables(step.instructions));
          })  
        }
      });
    }
    this.versionTable.push(<Dependency>{component: 'PostgreSQL', version: this.allInstructions.postgresqlVersions},
          <Dependency>{component: 'WildFly', version: this.allInstructions.wildflyVersion});
    this.parameterMap.iomToVersion = this.to.version;
    this.parameterMap.wildflyVersion = this.allInstructions.wildflyVersion;
    this.renderTarget(this.globalRecomms);

    console.log(this.allInstructions)

    //this.requirementsTable.renderRows();


/*
    // Find applicable steps and organize them into before, during, and after upgrade
    for (const step of this.steps) {
      if (step.level <= this.level && step.necessaryAsOf > this.from.number) {
        // Check Options
        // Only show steps that don't have a required option
        // Or when the user has a matching option selected
        let skip = false;
        for (const option of this.optionList) {
          // Skip steps which require an option not set by the user.
          if (step[option.id] && !this.options[option.id]) {
            skip = true;
          }

          // Skip steps which require **not** using an option which **is** set
          // by the user.
          if (step[option.id] === false && this.options[option.id]) {
            skip = true;
          }
        }
        if (skip) {
          continue;
        }

        // Render and replace variables
        step.renderedStep = snarkdown(this.replaceVariables(getLocalizedAction(currentLocale.locale, step)));

        // If you could do it before now, but didn't have to finish it before now
        if (step.possibleIn <= this.from.number && step.necessaryAsOf >= this.from.number) {
          this.beforeRecommendations.push(step);
          // If you couldn't do it before now, and you must do it now
        } else if (step.possibleIn > this.from.number && step.necessaryAsOf <= this.to.number) {
          this.duringRecommendations.push(step);
        } else if (step.possibleIn <= this.to.number) {
          this.afterRecommendations.push(step);
        } else {
        }
      }
    }*/

    // Update the URL so users can link to this transition
    const searchParams = new URLSearchParams();
    //if (currentLocale.locale && this.saveLocale) {
    //  searchParams.set('locale', currentLocale.locale);
    //}
    searchParams.set('v', `${this.from.version}-${this.to.version}`);
    this.location.replaceState('', searchParams.toString());
  }

  getAdditionalDependencies(version: number) {
    if (version < 500) {
      return `typescript@'>=2.1.0 <2.4.0'`;
    } else if (version < 600) {
      return `typescript@2.4.2 rxjs@^5.5.2`;
    } else {
      return `typescript@2.7.x rxjs@^6.0.0`;
    }
  }
  getAngularVersion(version: number) {
    if (version < 400) {
      return `'^2.0.0'`;
    } else {
      const major = Math.floor(version / 100);
      const minor = Math.floor((version - major * 100) / 10);
      return `^${major}.${minor}.0`;
    }
  }


  replaceVariables(action: string) {
    let newAction = action;
    newAction = newAction.replace(/\${\w+}/g, rpl => this.replacer(rpl, this.parameterMap));
    return newAction;
  }

  replacer(substring: string, parameterMap: any) {
    let key = substring.match(/\${(\w+)}/)[1];
    return parameterMap[key];
  }

  getVersion(newVersion: string) {
    return this.versions.find((version) => version.version === newVersion);
  }

  log(x) {
    console.log(x);
    return x;
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
