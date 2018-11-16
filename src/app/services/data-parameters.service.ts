import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DatesAndParams } from '../models/datesandparams.model';
import { CurrentUnixTimeService } from '../services/current-unix-time.service';

@Injectable({
    providedIn: 'root'
})
export class DataParametersService {
    twelveHours = 43200; // number of seconds in twelve hours

    constructor(private currentUnixTimeService: CurrentUnixTimeService) {}

    /**
     * Reduces a timestamp by 12 hours
     * @param {number} ts A timestamp as an Epoch
     * @returns {number} A timestamp as an Epoch
     */
    private reduceTimeStampByTwelveHours(ts: number): number {
        return (ts -= this.twelveHours);
    }

    /**
     * Returns the number of seconds in 12 hours
     * @returns {number} a timestamp as an Epoch
     */
    getTwelveHoursInSeconds(): number {
        return this.twelveHours;
    }

    /**
     * Returns an object containing start and end timestamps and http params based on
     * the previous 12 hour period
     * @returns {DatesAndParams} An object combining the start and end  timestamps and the http params
     */
    getCurrentDatesAndParams(): DatesAndParams {
        const _currentStartDate =
            this.currentUnixTimeService.getCurrentUnixTime() -
            this.getTwelveHoursInSeconds();
        const _currentEndDate = this.currentUnixTimeService.getCurrentUnixTime();
        const datesAndParams = {} as DatesAndParams;

        datesAndParams.startDate = _currentStartDate;
        datesAndParams.endDate = _currentEndDate;
        datesAndParams.params = new HttpParams({
            fromObject: {
                sdate: '' + _currentStartDate,
                edate: '' + _currentEndDate
            }
        });

        return datesAndParams;
    }

    /**
     * Returns an object containing start and end timestamps and http params based on
     * the period 12 hours before the previous 12 hour period
     * @param {number} lastStartDate the last start timestamp as an Epoch
     * @param {number} lastEndDate the last end timestamp as an Epoch
     */
    getEarlierDatesAndParams(
        lastStartDate: number,
        lastEndDate: number
    ): DatesAndParams {
        const _lastStartDate = this.reduceTimeStampByTwelveHours(lastStartDate);
        const _lastEndDate = this.reduceTimeStampByTwelveHours(lastEndDate);
        const datesAndParams = {} as DatesAndParams;

        datesAndParams.startDate = _lastStartDate;
        datesAndParams.endDate = _lastEndDate;
        datesAndParams.params = new HttpParams({
            fromObject: {
                sdate: '' + _lastStartDate,
                edate: '' + _lastEndDate
            }
        });

        return datesAndParams;
    }
}
