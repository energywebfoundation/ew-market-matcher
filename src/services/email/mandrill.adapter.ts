import { IEmailAdapter } from './IEmailAdapter';
import mandrill from 'mandrill-api/mandrill';

export class MandrillEmailAdapter implements IEmailAdapter {
    private mandrill;

    constructor () {
        this.mandrill = new mandrill.Mandrill('API_KEY');
    }

    async send(
        from: string,
        to: string[],
        subject: string,
        html: string
    ): Promise<boolean> {
        const toFormatted = to.map(email => {
            return {
                email,
                name: email,
                type: 'to'
            };
        });

        const message = {
            html,
            subject,
            from_email: from,
            from_name: 'Energy Web Origin',
            to: toFormatted
        };

        const result = await this.mandrill.messages.send({ message, async: true });

        return result === 'sent';
    }
}
