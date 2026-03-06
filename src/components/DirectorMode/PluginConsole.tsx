import React, { useState, forwardRef, useImperativeHandle } from 'react';

export interface PluginConsoleRef {
    log: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export const PluginConsole = forwardRef<PluginConsoleRef, {}>((props, ref) => {
    const [logs, setLogs] = useState<{time: string, msg: string, type: string}[]>([]);

    useImperativeHandle(ref, () => ({
        log: (message: string, type = 'info') => {
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
            setLogs(prev => [...prev, { time: timestamp, msg: message, type }].slice(-12)); // Keep last 12
        }
    }));

    return (
        <div className="plugin-console">
            <div className="console-header">
                <div className="console-title">VERITAS_SYSTEM_LOG.exe (Live)</div>
                <div className="status-indicator"></div>
            </div>
            <div className="console-body">
                {logs.map((log, i) => (
                    <div key={i} className={`log-line ${log.type}`}>
                        <span className="log-time">[{log.time}]</span> 
                        <span className="log-msg">{log.msg}</span>
                    </div>
                ))}
                {logs.length === 0 && <div className="log-line info">System Ready. Waiting for input...</div>}
                <div style={{ float:"left", clear: "both" }}
                     ref={(el) => { if (el) { el.scrollIntoView({ behavior: "smooth" }); } }}>
                </div>
            </div>
        </div>
    );
});
