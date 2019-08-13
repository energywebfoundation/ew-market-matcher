import { IEmailAdapter } from './email/IEmailAdapter';

export interface IEmailServiceProvider {
    adapter: IEmailAdapter;
    send: (to: string[], subject: string, html: string) => void;
}

export class EmailServiceProvider implements IEmailServiceProvider {
    public adapter: IEmailAdapter;
    private fromEmail: string;

    constructor (adapter: IEmailAdapter, fromEmail: string) {
        this.adapter = adapter;
        this.fromEmail = fromEmail;
    }

    send(to: string[], subject: string, html: string) {
        this.adapter.send(this.fromEmail, to, subject, html);
    }
}
