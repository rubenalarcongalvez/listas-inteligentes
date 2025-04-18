import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { StepperModule } from 'primeng/stepper';
import { CalendarModule } from 'primeng/calendar';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { MessagesModule } from 'primeng/messages';
import { AvatarModule } from 'primeng/avatar';
import { AccordionModule } from 'primeng/accordion';
import { SidebarModule } from 'primeng/sidebar';
import { DataViewModule } from 'primeng/dataview';
import { CheckboxModule } from 'primeng/checkbox';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { AutoCompleteModule } from 'primeng/autocomplete';
import {DragDropModule} from '@angular/cdk/drag-drop';
import { BadgeModule } from 'primeng/badge';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@NgModule({
  declarations: [],
  exports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    ToastModule,
    StepperModule,
    CalendarModule,
    FloatLabelModule,
    SelectButtonModule,
    ConfirmDialogModule,
    InputTextModule,
    PaginatorModule,
    DialogModule,
    MessagesModule,
    AvatarModule,
    AccordionModule,
    MessagesModule,
    SidebarModule,
    DataViewModule,
    CheckboxModule,
    OverlayPanelModule,
    AutoCompleteModule,
    DragDropModule,
    BadgeModule,
    ProgressSpinnerModule
  ]
})
export class PrimeNgModule { }
