-- AIFramework schema — run once on GBITR01V.
-- Requires CREATE DATABASE privilege (ReadUser has dbcreator role).

IF DB_ID('AIFramework') IS NULL
    CREATE DATABASE AIFramework;
GO

USE AIFramework;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        userOid       NVARCHAR(64)  NOT NULL PRIMARY KEY,
        email         NVARCHAR(256) NOT NULL,
        displayName   NVARCHAR(256) NULL,
        firstLoginAt  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        lastLoginAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Users_Email ON dbo.Users(email);
END;
GO

IF OBJECT_ID('dbo.ChatSessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatSessions (
        sessionId     UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        userOid       NVARCHAR(64)     NOT NULL,
        title         NVARCHAR(200)    NOT NULL DEFAULT N'New chat',
        systemPrompt  NVARCHAR(MAX)    NULL,
        createdAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        isDeleted     BIT              NOT NULL DEFAULT 0,
        CONSTRAINT FK_ChatSessions_Users FOREIGN KEY (userOid) REFERENCES dbo.Users(userOid)
    );
    CREATE INDEX IX_ChatSessions_User_Updated ON dbo.ChatSessions(userOid, updatedAt DESC) WHERE isDeleted = 0;
END;
GO

IF OBJECT_ID('dbo.ChatMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatMessages (
        messageId     BIGINT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        sessionId     UNIQUEIDENTIFIER NOT NULL,
        userOid       NVARCHAR(64)     NOT NULL,
        role          NVARCHAR(16)     NOT NULL CHECK (role IN ('user','assistant','system')),
        content       NVARCHAR(MAX)    NOT NULL,
        tokenCount    INT              NULL,
        createdAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ChatMessages_Sessions FOREIGN KEY (sessionId) REFERENCES dbo.ChatSessions(sessionId)
    );
    CREATE INDEX IX_ChatMessages_Session ON dbo.ChatMessages(sessionId, createdAt);
    CREATE INDEX IX_ChatMessages_User    ON dbo.ChatMessages(userOid, createdAt);
END;
GO
