import { DatePipe } from '@angular/common';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import {
    Component,
    EventEmitter,
    OnInit,
    Output,
    ViewChild
} from '@angular/core';
import { MatSort, MatTableDataSource } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import { AmplifyService } from 'aws-amplify-angular';
import { AuthState } from 'aws-amplify-angular/dist/src/providers/auth.state';
import { DatesAndParams } from '../../models/datesandparams.model';
import { DynamoTableData } from '../../models/dynamotabledata.model';
import { DynamoTableItem } from '../../models/dynamotableitem.model';
import { HomeTableItem } from '../../models/hometableitem.model';
import { DataParametersService } from '../../services/data-parameters.service';
import { DynamoDBService } from '../../services/dynamodb.service';
@Component({
    selector: 'app-home-table',
    templateUrl: './home-table.component.html',
    styleUrls: ['./home-table.component.scss']
})
export class HomeTableComponent implements OnInit {
    displayedColumns = ['name', 'value'];
    dataSource: MatTableDataSource<HomeTableItem>;

    @ViewChild(MatSort)
    sort: MatSort;

    dataFilteredByPathway: DynamoTableData[];
    averageDataFilteredByPathway: DynamoTableItem[];
    reshapedData: HomeTableItem[];

    showSpinner = true;

    pathways = [
        { value: 'FNorth', viewValue: 'North' },
        { value: 'FPC', viewValue: 'Point Comfort' }
    ];

    selectedPathway: string;
    selectedAverage: string;

    averages = [
        { value: '5', viewValue: '' },
        { value: '.5', viewValue: '' },
        { value: '.5', viewValue: '' },
        { value: '1', viewValue: '' },
        { value: '12', viewValue: '' },
        { value: '24', viewValue: '' }
    ];

    ad_signal: string;
    ad_shelter_temp: string;
    ad_amb_pressure: string;
    ad_amb_temp: string;

    @Output()
    lastTimestamp = new EventEmitter<Object>();

    _authState: AuthState;
    _idToken: string;

    dataParams: HttpParams;

    lastStartDate: number;
    lastEndDate: number;

    constructor(
        private dataParametersService: DataParametersService,
        private dynamoService: DynamoDBService,
        private translateService: TranslateService,
        private datePipe: DatePipe,
        private amplifyService: AmplifyService
    ) {
        // run translations
        translateService.get('minutes').subscribe((text: string) => {
            this.averages[0].viewValue = this.averages[0].value + ' ' + text;
            this.averages[1].viewValue =
                +this.averages[1].value * 60 + ' ' + text;
        });
        translateService.get('minutes (rolling)').subscribe((text: string) => {
            this.averages[2].viewValue =
                +this.averages[2].value * 60 + ' ' + text;
        });
        translateService.get('hour (rolling)').subscribe((text: string) => {
            this.averages[3].viewValue = this.averages[3].value + ' ' + text;
        });
        translateService.get('hours (rolling)').subscribe((text: string) => {
            this.averages[4].viewValue = this.averages[4].value + ' ' + text;
            this.averages[5].viewValue = this.averages[5].value + ' ' + text;
        });
    }

    ngOnInit() {
        // Initial data params
        this.setDataToCurrent();

        // Select initial pathway
        this.selectedPathway = 'FNorth';

        // Select inital average interval
        this.selectedAverage = '5';

        this.amplifyService
            .auth()
            .currentSession()
            .then(session => {
                this._idToken = session.getIdToken().getJwtToken();
                this.getSpectrumData(this.selectedPathway);
            });
    }

    /**
     * Calls a service to get data based on a 5 minute average
     * Start and end dates are Epoch timestamps and are called in 12 hour increments
     * @param {string} pathway A string that identifies what pathway to get data from
     * @returns void
     */
    getSpectrumData(pathway: string): void {
        this.showSpinner = true;
        this.selectedPathway = pathway;

        const headers: HttpHeaders = new HttpHeaders({
            'Content-Type': 'application/json',
            Authorization: this._idToken
        });

        this.dynamoService.getData(headers, this.dataParams).subscribe(
            results => {
                if (results[0][0]) {
                    if (results[0][0].length > 1) {
                        this.dataFilteredByPathway = [];
                        this.dataFilteredByPathway = results[0][0].filter(
                            (element, index, array) => {
                                return element.pathway === this.selectedPathway;
                            }
                        );
                        if (this.dataFilteredByPathway.length > 0) {
                            this.reshape5MinuteData();
                        } else {
                            this.setDataToPast();
                            this.getSpectrumData(this.selectedPathway);
                        }
                    } else {
                        this.setDataToPast();
                        this.getSpectrumData(this.selectedPathway);
                    }
                } else {
                    this.setDataToPast();
                    this.getSpectrumData(this.selectedPathway);
                }
            },
            error => {
                console.log(error);
            }
        );
    }

    /**
     * Calls a service to set the start and end timestamps to the previous 12 hour period
     * @returns void
     */
    setDataToCurrent(): void {
        const currentDatesAndParams: DatesAndParams = this.dataParametersService.getCurrentDatesAndParams();

        this.lastStartDate = currentDatesAndParams.startDate;
        this.lastEndDate = currentDatesAndParams.endDate;

        this.dataParams = new HttpParams({
            fromObject: {
                sdate: '' + this.lastStartDate,
                edate: '' + this.lastEndDate
            }
        });
    }

    /**
     * Calls a service to set the start and end timestamps to an additional 12 hours prior,
     * in case no recent data has been recorded
     * @returns void
     */
    setDataToPast(): void {
        const pastDatesAndParams: DatesAndParams = this.dataParametersService.getEarlierDatesAndParams(
            this.lastStartDate,
            this.lastEndDate
        );

        // update data params
        this.dataParams = pastDatesAndParams.params;

        // update local start and end dates
        this.lastStartDate = pastDatesAndParams.startDate;
        this.lastEndDate = pastDatesAndParams.endDate;
    }

    /**
     * Assigns the current MatTableDataSource to the material table
     * @returns void
     */
    assignDataSourceToTable(): void {
        // Hide the loading spinner
        this.showSpinner = false;

        // Assign the data to the data source for the table to render
        this.dataSource = new MatTableDataSource(this.reshapedData);
        this.dataSource.sort = this.sort;
    }

    /**
     * Calls a service to get average data based on hours
     * @param {number} hours The number of hours to average data
     * @returns void
     */
    getAverages(hours: number): void {
        this.showSpinner = true;

        const headers: HttpHeaders = new HttpHeaders({
            'Content-Type': 'application/json',
            Authorization: this._idToken
        });

        const params: HttpParams = new HttpParams({
            fromObject: {
                hours: '' + hours
            }
        });

        this.dynamoService.getAverages(headers, params).subscribe(
            results => {
                this.averageDataFilteredByPathway = [];
                this.averageDataFilteredByPathway = results[1][0].filter(
                    (element, index, array) => {
                        if (element.pathway === this.selectedPathway) {
                            return element;
                        }
                    }
                );

                this.reshapeAverageData();
            },
            error => {
                console.log(error);
            }
        );
    }

    /**
     * Fetches data based on the selected pathway
     * @param event the select event from the pathway selector
     * @returns void
     */
    onSelectPathway(event): void {
        // Reset data params to current
        this.setDataToCurrent();

        // If selected average value is '5', call getSpectrumData
        if (this.selectedAverage === '5') {
            this.getSpectrumData(event.value);
        } else {
            this.getAverages(+this.selectedAverage);
        }
    }

    /**
     * Fetches data based on the selected averages period
     * @param event the select event from the averages selector
     * @returns void
     */
    onSelectAverage(event): void {
        // If selected value is '5', call getSpectrumData
        if (event.value === '5') {
            this.getSpectrumData(this.selectedPathway);
        } else {
            this.getAverages(event.value);
        }
    }

    /**
     * Displays the currently selected pathway
     * @returns void
     */
    getPathwayNameFromSelected(): string {
        let displayedPathway = '';
        this.pathways.forEach((element, index, array) => {
            if (element.value === this.selectedPathway) {
                displayedPathway = element.viewValue;
            }
        });
        return displayedPathway;
    }

    /**
     * Gets the correct label for the selected averages period
     * @return void
     */
    getAveragesLabelFromSelected(): string {
        let displayedAverage = '';
        this.averages.forEach((element, index, array) => {
            if (element.value === this.selectedAverage) {
                displayedAverage = element.viewValue;
            }
        });
        return displayedAverage;
    }

    /**
     * Shapes the 5 minute data to the format needed by the home table
     * @returns void
     */
    reshape5MinuteData(): void {
        this.reshapedData = [];
        const additionalData: any[] = [];

        this.dataFilteredByPathway.forEach((item, index, array) => {
            if (index === array.length - 1) {
                // Capture and emit the timestamp
                this.emitTimestamp(item['event_timestamp']);

                this.reshapedData.push({
                    name: 'Wind Speed (mph)',
                    value: +item['WindSpeed(MPH)']
                });
                this.reshapedData.push({
                    name: 'Wind Direction (deg)',
                    value: +item['WindDir(deg)']
                });
                this.reshapedData.push({
                    // i cant figoure out the if/else routine for < DL /_F
                    name: '1,3 Butadiene (ppb)',
                    value: item['BUT_F']
                });
                this.reshapedData.push({
                    name: 'Ethylene (ppb)',
                    value: item['C2H4_F']
                });
                this.reshapedData.push({
                    name: 'Benzene (ppb)',
                    value: item['C6H6_F']
                });
                this.reshapedData.push({
                    name: '1,2 Dichloroethane (ppb)',
                    value: item['DCA_F']
                });
                this.reshapedData.push({
                    name: 'Ethylene Oxide (ppb)',
                    value: item['ETO_F']
                });
                this.reshapedData.push({
                    name: 'Hydrogen Chloride (ppb)',
                    value: item['HCl_F']
                });
                this.reshapedData.push({
                    name: 'Vinyl Chloride (ppb)',
                    value: item['VCl_F']
                });
                this.reshapedData.push({
                    name: 'Water (ppm)',
                    value: +item['H2O']
                });
                this.reshapedData.push({
                    name: 'Carbon Dioxide (ppm)',
                    value: +item['CO2']
                });
                this.reshapedData.push({
                    name: 'Methane (ppm)',
                    value: +item['CH4']
                });

                // Push additional data to array
                additionalData.push(+item['SGL_Max']);
                additionalData.push(+item['Shelter_Temp(C)']);
                additionalData.push(+item['Press(atm)']);
                additionalData.push(+item['Temp(C)']);
            }
        });

        // Populate additional data
        this.populateAdditionalData(additionalData);

        // Assign this data to the table's datasource
        this.assignDataSourceToTable();
    }

    /**
     * Shapes the hourly average data to the format needed by the home table
     * @returns void
     */
    reshapeAverageData(): void {
        this.reshapedData = [];
        const additionalData: any[] = [];

        this.averageDataFilteredByPathway.forEach((item, index, array) => {
            this.reshapedData.push({
                name: 'Wind Speed (mph)',
                value: +item['WindSpeed(MPH)']
            });
            this.reshapedData.push({
                name: 'Wind Direction (deg)',
                value: +item['WindDir(deg)']
            });
            this.reshapedData.push({
                name: '1,3 Butadiene (ppb)',
                value: item['BUT_F']
            });
            this.reshapedData.push({
                name: 'Ethylene (ppb)',
                value: item['C2H4_F']
            });
            this.reshapedData.push({
                name: 'Benzene (ppb)',
                value: item['C6H6_F']
            });
            this.reshapedData.push({
                name: '1,2 Dichloroethane (ppb)',
                value: item['DCA_F']
            });
            this.reshapedData.push({
                name: 'Ethylene Oxide (ppb)',
                value: item['ETO_F']
            });
            this.reshapedData.push({
                name: 'Hydrogen Chloride (ppb)',
                value: item['HCl_F']
            });
            this.reshapedData.push({
                name: 'Vinyl Chloride (ppb)',
                value: item['VCl_F']
            });
            this.reshapedData.push({
                name: 'Water (ppm)',
                value: +item['H2O']
            });
            this.reshapedData.push({
                name: 'Carbon Dioxide (ppm)',
                value: +item['CO2']
            });
            this.reshapedData.push({
                name: 'Methane (ppm)',
                value: +item['CH4']
            });

            additionalData.push(+item['SGL_Max']);
            additionalData.push(+item['Shelter_Temp(C)']);
            additionalData.push(+item['Press(atm)']);
            additionalData.push(+item['Temp(C)']);
        });

        // Populate additional data
        this.populateAdditionalData(additionalData);

        // Assign this data to the table's datasource
        this.assignDataSourceToTable();
    }

    /**
     * Populates the 'additional data' section of the UI
     * @param data an array of additional data to be displayed
     * @returns void
     */
    populateAdditionalData(data: any[]): void {
        this.ad_signal = data[0];
        this.ad_shelter_temp = data[1];
        this.ad_amb_pressure = data[2];
        this.ad_amb_temp = data[3];
    }

    /**
     * Emits a timestamp output for use by the parent component
     * @param {number} ts a timestamp in Epoch time
     * @returns void
     */
    emitTimestamp(ts: number): void {
        const tsConverted = this.convertTimestampToDate(ts * 1000);
        const tsObj = { ts: ts, tsConverted: tsConverted };
        this.lastTimestamp.emit(tsObj);
    }

    /**
     * Converts an Epoch timestamp to a date
     * @param {number} ts a timestamp in Epoch time
     * @returns void
     */
    convertTimestampToDate(ts: number): string {
        return this.datePipe.transform(ts, 'medium', '-0000');
    }
}
