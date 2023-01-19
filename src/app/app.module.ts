import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { APP_BASE_HREF, Location, LocationStrategy, PathLocationStrategy } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import {MatChipsModule} from '@angular/material/chips'; 
import { MatTableModule } from '@angular/material/table';
import { I18nPipe } from './i18n.pipe';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [AppComponent, I18nPipe],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatToolbarModule,
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    MatCardModule,
    MatListModule,
    MatGridListModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    MatMenuModule,
    HttpClientModule,
    MatChipsModule,
    MatTableModule
  ],
  providers: [Location, { provide: LocationStrategy, useClass: PathLocationStrategy },
     {provide: APP_BASE_HREF, useValue: environment.baseHref}],
  bootstrap: [AppComponent],
})
export class AppModule {}
