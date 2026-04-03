# ASP.NET Core on Linux — deploy to Render, Fly.io, Azure Container Apps, etc.
# Vercel does not host full ASP.NET Core apps; use this container or Azure App Service instead.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ShopWeb/ ShopWeb/
WORKDIR /src/ShopWeb
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "ShopWeb.dll"]
