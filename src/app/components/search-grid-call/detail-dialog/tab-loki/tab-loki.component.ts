import { Component, OnInit, Input, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { DateTimeRangeService } from '@app/services/data-time-range.service';
import { SearchRemoteService } from '@app/services';
import { SearchService } from '@app/services';
import { PreferenceAdvancedService } from '@app/services';

@Component({
    selector: 'app-tab-loki',
    templateUrl: './tab-loki.component.html',
    styleUrls: ['./tab-loki.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class TabLokiComponent implements OnInit {
    @Input() id;
    @Input() dataItem: any;
    queryText: string;
    queryObject: any;
    rxText: string;
    showTime: true;
    showTags: false;
    showTs: true;
    checked: boolean;
    resultData: Array<any> = [];
    isFirstSearch = true;
    labels: Array<any> = [];
    lokiLabels;
    lokiTemplate;
    lokiLimit;
    dataSource: Array<any> = []
    constructor(
        private _pas: PreferenceAdvancedService,
        private _srs: SearchRemoteService,
        private _dtrs: DateTimeRangeService,
        private searchService: SearchService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        const data = this.dataItem.data;
        const labels = data.calldata.map(i => i.sid).reduce((a, b) => {
            if (a.indexOf(b) === -1) {
                a.push(b);
            }
            return a;
        }, []).join('|');
        this.lokiTemplate = {
            lineFilterOperator: '|~',
            logStreamSelector: '{job="heplify-server"}'
        };
        this._pas.getAll().toPromise().then((advanced: any) => {
            const loki = advanced.data
            .filter(i => i.category === 'search' && i.param === 'lokiserver')
            const [advancedTemplate] = loki.map(i => i.data.template);
            [this.lokiLimit] = loki.map(i => i.data.limit)
            if (typeof advancedTemplate !== 'undefined'
            && (advancedTemplate.hasOwnProperty('logStreamSelector') || advancedTemplate.hasOwnProperty('lineFilterOperator'))) {
                this.lokiTemplate = advancedTemplate;
            }
            if (typeof this.lokiTemplate !== 'undefined') {
                this.queryText = `${this.lokiTemplate.logStreamSelector ? this.lokiTemplate.logStreamSelector : ''}${this.lokiTemplate.lineFilterOperator}"${labels}"`;
                this.cdr.detectChanges();
            }
            this.cdr.detectChanges();
        });

        this.cdr.detectChanges();
    }
    async doSerchResult () {
        this.rxText = this.queryObject.rxText;
        this.isFirstSearch = false;
        const data = await this._srs.getData(this.queryBuilder()).toPromise();

        this.resultData = data && data.data ? data.data as Array<any> : [];
        this.lokiLabels = this.resultData.map((l) => {
            l.custom_2 = this.labelsFormatter(l.custom_2);
            return l;
         })
        this.resultData = this.resultData.map((m) => {
            m.custom_1 = this.highlight(m.custom_1);
            return m;
        });

        this.cdr.detectChanges();
    }
    onUpdateData (event) {
        this.queryObject = event;
        if (typeof this.lokiLimit !== 'undefined' && this.lokiLimit !== null && this.lokiLimit > 0) {
            this.queryObject.limit = this.lokiLimit;
        } else {
            this.queryObject.limit = 100;
        }
        this.cdr.detectChanges();
    }
    queryBuilder() { /** depricated, need use {SearchService} */
        return {
            param: {
                server: this.queryObject.serverLoki, // 'http://127.0.0.1:3100',
                limit: this.queryObject.limit * 1,
                search: this.queryObject.text,
                timezone: this.searchService.getTimeZoneLocal()
            },
            timestamp: this._dtrs.getDatesForQuery(true)
        };
    }

    private labelsFormatter(rd) {
        return JSON.parse(rd);
    }

    identify (index, item) {
        return item.micro_ts;
    }

    private highlight(value: string = '') {
        let data;
        if (!!this.rxText) {
            const rxText = this.rxText.replace(/\s|(\|=|\|~|!=|!~)|("|`)/g, '').split('|').sort((a,b) => b.length - a.length).join('|');
            const regex = new RegExp('(' + rxText + ')', 'g');
            data = value
                .replace(/\</g, '&lt;')
                .replace(/\>/g, '&gt;')
                .replace(regex, (g, a) => {
                    return `<span>${a}</span>`;
                });
        } else {
            data = value || '';
        }
        return data;
    }
}
