export interface IEmailAdapter {
    send(
        from: string,
        to: string[],
        subject: string,
        html: string
    ): Promise<boolean>;
}
